import { GitHubSourceActionProps } from "aws-cdk-lib/aws-codepipeline-actions";

type GitHubRepositoryParameters = {
  type: "GITHUB_REPO";
  personnalTokenSecretName: string;
} & Pick<GitHubSourceActionProps, "owner" | "repo" | "branch">;

type StageParameters = {
  name: string;
  awsAccountId: string;
  deployToRegions: string[];
  manualApprovalBeforeDeployment?: boolean;
  manualApprovalSubscribers?: string[];
};

export type CicdParameters = {
  stackName: string;
  repositoryParameters: GitHubRepositoryParameters;
  buildDockerfilePath: string;
  stages: StageParameters[];
};
