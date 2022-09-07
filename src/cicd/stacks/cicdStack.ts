import { StackContext } from "@serverless-stack/resources";
import { SecretValue } from "aws-cdk-lib";
import { Artifact, Pipeline } from "aws-cdk-lib/aws-codepipeline";
import { CodeBuildAction, GitHubSourceAction, ManualApprovalAction } from "aws-cdk-lib/aws-codepipeline-actions";
import { BuildSpec, LinuxBuildImage, PipelineProject } from "aws-cdk-lib/aws-codebuild";
import { Effect, PolicyDocument, PolicyStatement, Role, ServicePrincipal } from "aws-cdk-lib/aws-iam";
import { Subscription, SubscriptionProtocol, Topic } from "aws-cdk-lib/aws-sns";
import { CicdParameters } from "./types";

export const buildCicdStack = (params: CicdParameters) => {
  return ({ app, stack }: StackContext) => {
    const stackName = params.stackName;
    const repositorySettings = params.repositoryParameters;
    const dockerfilePath = params.buildDockerfilePath;

    const githubArtifacts = new Artifact();
    //const buildArtifacts = new Artifact(); // TODO use that when sst can deploy from a build directory

    const pipeline = new Pipeline(stack, `${stackName}-pipeline`, {
      pipelineName: `${stackName}-pipeline`,
    });

    const sourceAction = new GitHubSourceAction({
      actionName: "SourceRepository",
      owner: repositorySettings.owner,
      repo: repositorySettings.repo,
      oauthToken: SecretValue.secretsManager(repositorySettings.personnalTokenSecretName),
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
        projectName: `${stackName}-build`,
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

    for (const stage of params.stages) {
      const stageName = stage.name;
      const deployActions = [];
      const targetRoleArn = `arn:aws:iam::${stage.awsAccountId}:role/${stackName}-${stageName}-AsccTargetDeploymentRole`;
      const codeBuildDeployRole = new Role(stack, `${stackName}-${stageName}-cb-deployment-role`, {
        roleName: `${stackName}-${stageName}-cb-deployment-role`,
        inlinePolicies: {
          assumeCrossAccountRole: new PolicyDocument({
            statements: [
              new PolicyStatement({
                effect: Effect.ALLOW,
                actions: ["sts:AssumeRole"],
                resources: [targetRoleArn],
              }),
            ],
          }),
        },
        assumedBy: new ServicePrincipal("codebuild.amazonaws.com"),
      });

      stack.addOutputs({
        [`${stageName}DeploymentRoleArn`]: codeBuildDeployRole.roleArn,
      });

      for (const region of stage.deployToRegions) {
        const deployAction = new CodeBuildAction({
          actionName: `deploy-services-${region}`,
          project: new PipelineProject(stack, `${stackName}-${stageName}-deploy-${region}`, {
            projectName: `${stackName}-${stageName}-deploy-${region}`,
            buildSpec: BuildSpec.fromObject({
              version: "0.2",
              phases: {
                install: {
                  commands: ["apt-get update", "apt-get install -y awscli jq"],
                },
                pre_build: {
                  //commands: ["npm install -g aws-cdk", "cd $CODEBUILD_SRC_DIR/.build"], // TODO use that when sst can deploy from a build directory
                  commands: [
                    `TEMP_ROLE=$(aws sts assume-role --role-arn ${targetRoleArn} --role-session-name AsccDeployment --duration-seconds 1800)`,
                    `export AWS_ACCESS_KEY_ID=$(echo "\${TEMP_ROLE}" | jq -r '.Credentials.AccessKeyId')`,
                    `export AWS_SECRET_ACCESS_KEY=$(echo "\${TEMP_ROLE}" | jq -r '.Credentials.SecretAccessKey')`,
                    `export AWS_SESSION_TOKEN=$(echo "\${TEMP_ROLE}" | jq -r '.Credentials.SessionToken')`,
                    "npm install",
                  ],
                },
                build: {
                  commands: [`npx sst deploy --stage ${stageName} --region ${region}`],
                },
              },
            }),
            environment: {
              buildImage: LinuxBuildImage.fromDockerRegistry("public.ecr.aws/docker/library/node:16-bullseye-slim"),
            },
            role: codeBuildDeployRole,
          }),
          //input: buildArtifacts, // TODO use that when sst can deploy from a build directory
          input: githubArtifacts,
        });

        deployActions.push(deployAction);
      }

      // TODO eventually add some end-to-end tests with AWS Lambda here

      if (stage.manualApprovalBeforeDeployment && stage.manualApprovalSubscribers) {
        const snsTopic = new Topic(stack, `${stackName}-${stageName}-approval`);

        for (const email of stage.manualApprovalSubscribers) {
          new Subscription(stack, `${stackName}-${stageName}-approval-sub-${email.substring(0, email.indexOf("@"))}`, {
            topic: snsTopic,
            protocol: SubscriptionProtocol.EMAIL,
            endpoint: email,
          });
        }

        const manualApproval = new ManualApprovalAction({
          actionName: `manual-approval-${stageName}-deploy`,
          notificationTopic: snsTopic,
          additionalInformation: `The build for your application ${stackName} is ready to be deployed to ${stageName}! Review that everything is ok, and approve the deployment!`,
        });

        pipeline.addStage({
          stageName: `${stageName}Approval`,
          actions: [manualApproval],
        });
      }

      pipeline.addStage({
        stageName: `DeployTo${stageName}`,
        actions: deployActions,
      });
    }
  };
};
