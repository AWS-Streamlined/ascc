#!/usr/bin/env node
import yargs, { Argv } from "yargs";
import { spawn, sync } from "cross-spawn";
import { readFile, writeFile } from "fs/promises";
import { jsonParametersSchema } from "./jsonParametersSchema";

const { stdout } = sync("npm", ["config", "get", "prefix"], { env: process.env, stdio: "pipe", encoding: "utf-8" });
const processPath = `${stdout.trim()}/lib/node_modules/ascc/bin/cicd`;

yargs
  .command(
    "create",
    "Creates a CICD pipeline for your project with AWS CodePipeline",
    (yargs: Argv) => {
      return yargs
        .option("params-file", {
          describe: "Path to a JSON file containing parameters for your CICD pipeline. For more information on the format, see <README_LINK>",
          type: "string",
          demandOption: true,
        })
        .option("aws-profile", {
          describe: "The AWS profile with which you want to deploy the CICD pipeline. If not provided, your default profile is used",
          type: "string",
        });
    },
    async (args) => {
      await validateJsonParameters(args["params-file"]);

      const parameters = ["exec", "sst", "deploy", "--", "--stage", "prod"];

      if (args["aws-profile"]) {
        parameters.push("--profile", args["aws-profile"]);
      }

      spawn("npm", parameters, { cwd: processPath, stdio: "inherit" });
    },
  )
  .command(
    "remove",
    "Removes the CICD pipeline previously created with the provided json parameters",
    (yargs: Argv) => {
      return yargs
        .option("params-file", {
          describe: "Path to a JSON file containing parameters for your CICD pipeline. For more information on the format, see <README_LINK>",
          type: "string",
          demandOption: true,
        })
        .option("aws-profile", {
          describe: "The AWS profile with which you want to deploy the CICD pipeline. If not provided, your default profile is used",
          type: "string",
        });
    },
    async (args) => {
      await validateJsonParameters(args["params-file"]);

      const parameters = ["exec", "sst", "remove", "--", "--stage", "prod"];

      if (args["aws-profile"]) {
        parameters.push("--profile", args["aws-profile"]);
      }

      spawn("npm", parameters, { cwd: processPath, stdio: "inherit" });
    },
  ).argv;

async function validateJsonParameters(paramsFilePath: string) {
  const cicdParametersJson = await readFile(paramsFilePath, { encoding: "utf8" });

  const valid = jsonParametersSchema(JSON.parse(cicdParametersJson));

  if (!valid) {
    console.error("Invalid parameters file!", jsonParametersSchema.errors);
    return;
  }

  await writeFile(`${processPath}/stacks/cicd_parameters.json`, cicdParametersJson);
}
