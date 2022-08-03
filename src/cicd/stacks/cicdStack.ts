import { StackContext } from "@serverless-stack/resources";
import { SecretValue } from "aws-cdk-lib";
import { Artifact, Pipeline } from "aws-cdk-lib/aws-codepipeline";
import { CodeBuildAction, GitHubSourceAction, GitHubSourceActionProps, ManualApprovalAction } from "aws-cdk-lib/aws-codepipeline-actions";
import { BuildSpec, LinuxBuildImage, PipelineProject } from "aws-cdk-lib/aws-codebuild";
import { Effect, PolicyDocument, PolicyStatement, Role, ServicePrincipal } from "aws-cdk-lib/aws-iam";
import { Subscription, SubscriptionProtocol, Topic } from "aws-cdk-lib/aws-sns";

type GitHubRepositoryParameters = {
  type: "GITHUB_REPO";
  oauthTokenSecretName: string;
} & Pick<GitHubSourceActionProps, "owner" | "repo" | "branch">;

export type CicdParameters = {
  stackName: string;
  repositoryParameters: GitHubRepositoryParameters;
  buildDockerfilePath: string;
  deployToRegions: string[];
  manualApprovalBeforeProdDeployment?: boolean;
  manualApprovalSubscribers?: string[];
};

export const buildCicdStack = (params: CicdParameters) => {
  const fn = ({ app, stack }: StackContext) => {
    const stackName = params.stackName;
    const repositorySettings = params.repositoryParameters;
    const dockerfilePath = params.buildDockerfilePath;
    const deployToRegions = params.deployToRegions;
    const manualApprovalBeforeProd = params.manualApprovalBeforeProdDeployment;
    const emailSubscribers = params.manualApprovalSubscribers;

    const githubArtifacts = new Artifact();
    //const buildArtifacts = new Artifact(); // TODO use that when sst can deploy from a build directory

    const pipeline = new Pipeline(stack, `${stackName}-pipeline`);

    const sourceAction = new GitHubSourceAction({
      actionName: "GitHubSource",
      owner: repositorySettings.owner,
      repo: repositorySettings.repo,
      oauthToken: SecretValue.secretsManager(repositorySettings.oauthTokenSecretName),
      output: githubArtifacts,
      branch: repositorySettings.branch,
    });

    pipeline.addStage({
      stageName: "Source",
      actions: [sourceAction],
    });

    const buildServicesAction = new CodeBuildAction({
      actionName: "BuildServices",
      project: new PipelineProject(stack, `${stackName}-build`, {
        buildSpec: BuildSpec.fromObject({
          version: "0.2",
          phases: {
            pre_build: {
              commands: [`docker build -t build-image --file ${dockerfilePath} .`],
            },
            build: {
              commands: [
                `docker run -e AWS_DEFAULT_REGION -e AWS_CONTAINER_CREDENTIALS_RELATIVE_URI -v $(pwd)/.build:/build/.build build-image:latest`,
              ],
            },
          },
          artifacts: {
            files: ["./.build/cdk.out/**/*"],
          },
        }),
        environment: {
          privileged: true,
        },
      }),
      input: githubArtifacts,
      //outputs: [buildArtifacts], // TODO use that when sst can deploy from a build directory
    });

    pipeline.addStage({
      stageName: "Build",
      actions: [buildServicesAction],
    });

    const deployRole = new Role(stack, `${stackName}-deploy-role`, {
      inlinePolicies: {
        test: new PolicyDocument({
          statements: [
            new PolicyStatement({
              effect: Effect.ALLOW,
              actions: ["*"],
              resources: ["*"],
            }),
          ],
        }),
      },
      assumedBy: new ServicePrincipal("codebuild.amazonaws.com"),
    });
    const deployActionPerStageForAllRegions: { [stageName: string]: CodeBuildAction[] } = {};

    for (const stage of ["alpha", "staging", "prod"]) {
      deployActionPerStageForAllRegions[stage] = [];

      for (const region of deployToRegions) {
        const deployAction = new CodeBuildAction({
          actionName: `deploy-services-${region}`,
          project: new PipelineProject(stack, `${stackName}-${stage}-deploy-${region}`, {
            buildSpec: BuildSpec.fromObject({
              version: "0.2",
              phases: {
                pre_build: {
                  //commands: ["npm install -g aws-cdk", "cd $CODEBUILD_SRC_DIR/.build"], // TODO use that when sst can deploy from a build directory
                  commands: ["npm install"],
                },
                build: {
                  commands: [`npm run deploy -- --stage ${stage} --region ${region}`],
                },
              },
            }),
            environment: {
              buildImage: LinuxBuildImage.fromDockerRegistry("public.ecr.aws/docker/library/node:16-bullseye-slim"),
            },
            role: deployRole,
          }),
          //input: buildArtifacts, // TODO use that when sst can deploy from a build directory
          input: githubArtifacts,
        });

        deployActionPerStageForAllRegions[stage].push(deployAction);
      }
    }

    pipeline.addStage({
      stageName: "DeployToAlpha",
      actions: deployActionPerStageForAllRegions["alpha"],
    });

    // TODO eventually add some end-to-end tests with AWS Lambda here

    pipeline.addStage({
      stageName: "DeployToStaging",
      actions: deployActionPerStageForAllRegions["staging"],
    });

    // TODO eventually add some end-to-end tests with AWS Lambda here

    if (manualApprovalBeforeProd && emailSubscribers) {
      const snsTopic = new Topic(stack, `${stackName}-prod-approval`);

      for (const email of emailSubscribers) {
        new Subscription(stack, `${stackName}-prod-approval-sub-${email.substring(0, email.indexOf("@"))}`, {
          topic: snsTopic,
          protocol: SubscriptionProtocol.EMAIL,
          endpoint: email,
        });
      }

      const manualApproval = new ManualApprovalAction({
        actionName: `manual-approval-prod-deploy`,
        notificationTopic: snsTopic,
        additionalInformation: `The build for your application ${stackName} is ready to be deployed to production! Review that everything is ok, and approval the deployment!`,
      });

      pipeline.addStage({
        stageName: "ProdApproval",
        actions: [manualApproval],
      });
    }

    pipeline.addStage({
      stageName: "DeployToProd",
      actions: deployActionPerStageForAllRegions["prod"],
    });
  };

  // Name the return function, as this is what SST uses to name stacks
  Object.defineProperty(fn, "name", { value: params.stackName });

  return fn;
};
