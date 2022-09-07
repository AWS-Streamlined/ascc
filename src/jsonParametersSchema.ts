import AJV from "ajv";
import addFormats from "ajv-formats";
const ajv = new AJV();
addFormats(ajv);

export const jsonParametersSchema = ajv.compile({
  type: "object",
  properties: {
    stackName: {
      description:
        "A name that will be used to differentiate your CICD stack from others. If you create CICD stacks for different projects with ASCC, these stacks will need to have different names.",
      type: "string",
      minLength: 1,
      maxLength: 15,
    },
    repositoryParameters: {
      oneOf: [
        {
          description: "GitHub Repository Parameters",
          type: "object",
          properties: {
            type: {
              description: "Differentiator field for different types of repositories.",
              type: "string",
              pattern: `^GITHUB_REPO$`,
            },
            personnalTokenSecretName: {
              description:
                "The name of the SecretsManager secret that stores your GitHub personnal access token. This secret should be created in us-east-1 region.",
              type: "string",
              minLength: 1,
            },
            owner: {
              description: "Username of the owner of the GitHub repository",
              type: "string",
              minLength: 1,
            },
            repo: {
              description: "Name of the GitHub repository",
              type: "string",
              minLength: 1,
            },
            branch: {
              description: "Branch which will trigger the CICD pipeline. E.g. main",
              type: "string",
              minLength: 1,
            },
          },
          required: ["type", "personnalTokenSecretName", "owner", "repo", "branch"],
        },
      ],
    },
    buildDockerfilePath: {
      description:
        "Path to the Dockerfile that will build/test/etc. your application. This Dockerfile should be committed into your application's repository. This should be a path relative to the root of your repository.",
      type: "string",
      minLength: 1,
    },
    stages: {
      description: "List of parameters for each stage to deploy to",
      type: "array",
      items: {
        type: "object",
        properties: {
          name: {
            description: "Name of the stage",
            type: "string",
            minLength: 1,
          },
          awsAccountId: {
            description: "The ID of the AWS account that will receive this stage",
            type: "string",
            minLength: 12,
          },
          deployToRegions: {
            description: "List of AWS regions where ASCC should should deploy your application",
            type: "array",
            items: {
              type: "string",
              minLength: 5,
            },
          },
          manualApprovalBeforeDeployment: {
            description:
              "(Optional) Set this to true if you want an approval gate before your application is deployed to this stage. The CICD pipeline will halt at this point.",
            type: "boolean",
          },
          manualApprovalSubscribers: {
            description: "(Optional) List of emails that should receive a notification when a pipeline execution has reached the approval gate.",
            type: "array",
            items: {
              type: "string",
              format: "email",
            },
          },
        },
        required: ["name", "awsAccountId", "deployToRegions"],
      },
    },
  },
  required: ["stackName", "repositoryParameters", "buildDockerfilePath", "stages"],
});
