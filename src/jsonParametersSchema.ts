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
            oauthTokenSecretName: {
              description:
                "The name of the SecretsManager secret that stores your GitHub OAuth token. This secret should be created in us-east-1 region.",
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
          required: ["type", "oauthTokenSecretName", "owner", "repo", "branch"],
        },
      ],
    },
    deployToRegions: {
      description:
        "List of AWS regions where ASCC should should deploy your application. Alpha/Staging/Prod environments will be deployed to all of these regions",
      type: "array",
      items: {
        type: "string",
        minLength: 5,
      },
    },
    manualApprovalBeforeProdDeployment: {
      description:
        "(Optional) Set this to true if you want an approval gate before your application is deployed to the production environment. The CICD pipeline will halt at this point.",
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
  required: ["stackName", "repositoryParameters", "deployToRegions"],
});
