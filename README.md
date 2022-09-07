# AWS Streamlined CI/CD - ASCC

ASCC aims at simplifying the creation of a proper CI/CD pipeline for SST applications, using AWS CodePipeline.

Pipelines created with this utility are able to deploy to any number of specified regions, and have three stages: alpha, staging, prod.

Here's what the pipeline looks like:

![CICD Pipeline](./docs/diagrams/awsStreamlinedCicdPipeline.excalidraw.png)

## Supported Languages

Currently, this pipeline only supports NodeJS SST applications. It should be possible to build a pipeline for any kind of SST
applications with docker. Feel free to open pull requests to add other Dockerfiles for other languages.

## Supported Repository Providers

The only supported repository provider for now is GitHub.

It should be relatively easy to add support for CodeCommit or BitBucket, since they are both
supported by AWS CodePipeline.

## Using ASCC

### 1. Install ASCC

```
npm install -g ascc
```

or

```
npm install --save-dev ascc
```

### 2. Build Dockerfile

Copy one of the example [Dockerfiles](./dockerfile-examples/), paste it at the root of your directory, and tune it to your needs.

### 3. Parameters

Create a parameters file for your pipeline

ASCC expects a JSON file with a predetermined set of parameters. Take a peak at [the example](./docs/cicd_parameters.example.json), or
at the full schema [the JSON schema](./src/jsonParametersSchema.ts) for all the details.

### 4. Create A Secret For Your Repository Credentials

To be able to checkout your source code, ASCC needs a token that authorizes it to your repository. You will need to store that token in a Secrets Manager secret, with the name that you have defined in your parameters file.

[GitHub personnal access token creation](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token). The personnal token should have the following access:

- repo - to read the repository
- admin:repo_hook - if you plan to use webhooks

### 5. Create Your CICD Pipeline

```
ascc create --params-file path/to/your/params/file [--aws-profile your_profile]
```

This will create all the required resources for your CI/CD pipeline. AWS CodePipeline will run the pipeline once by default, but it will fail to deploy. You need to complete the next step for deployment to succeed.

If you need to update your pipeline because you've changed parameters, simply re-run the command above.

ASCC will use your default AWS profile, or any other profile that you can specify with the `--aws-profile` option.

### 6. Create Target Deployment Roles

ASCC does not know the permissions needed to deploy your application, and it also does not create roles with admin access to your account for security best practices reasons. Instead, for the deployment to each stage, ASCC will assume a role that you should create, which should contain all the permissions required to deploy your application. After running the create command, you will have the ARNs for each deployment role in your terminal. You will need to use them to create a role for each stage, in the AWS account associated with that stage, with the following parameters:

Name: `<stackName>-<stageName>-AsccTargetDeploymentRole`, e.g. myApp-Alpha-AsccTargetDeploymentRole. ASCC will assume a role with this name.
Trust policy:

```
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "Statement1",
      "Effect": "Allow",
      "Principal": {
        "AWS": "<role_arn_from_terminal>"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
```

Policies: Whatever is needed to deploy your application

### 7. Remove Your CICD Pipeline

This will remove the resources for your CI/CD pipeline, _but not the resources for your application_. You will need to delete the CloudFormation stacks manually in your AWS accounts if you want to also remove your application resources.

```
ascc remove --params-file path/to/your/params/file [--aws-profile your_profile]
```

## Road Map

- [ ] Add support for end-to-end tests based on user-defined AWS Lambda Functions
