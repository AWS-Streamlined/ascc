import AJV from "ajv";
import addFormats from "ajv-formats";
const ajv = new AJV();
addFormats(ajv);

export const jsonParametersSchema = ajv.compile({
  type: "object",
  properties: {
    stackName: {
      type: "string",
      minLength: 1,
      maxLength: 15,
    },
    repositoryParameters: {
      oneOf: [
        {
          type: "object",
          properties: {
            type: {
              type: "string",
              pattern: `^GITHUB_REPO$`,
            },
            oauthTokenSecretName: {
              type: "string",
              minLength: 1,
            },
            owner: {
              type: "string",
              minLength: 1,
            },
            repo: {
              type: "string",
              minLength: 1,
            },
            branch: {
              type: "string",
              minLength: 1,
            },
          },
          required: ["type", "oauthTokenSecretName", "owner", "repo", "branch"],
        },
      ],
    },
    deployToRegions: {
      type: "array",
      items: {
        type: "string",
        minLength: 5,
      },
    },
    manualApprovalBeforeProdDeployment: {
      type: "boolean",
    },
    manualApprovalSubscribers: {
      type: "array",
      items: {
        type: "string",
        format: "email",
      },
    },
  },
  required: ["stackName", "repositoryParameters", "deployToRegions"],
});
