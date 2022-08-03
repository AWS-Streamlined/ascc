import { CicdParameters, buildCicdStack } from "./cicdStack";
import { App } from "@serverless-stack/resources";
import { readFile } from "fs/promises";

export default async function (app: App) {
  const cicdParametersJson = await readFile("./stacks/cicd_parameters.json", { encoding: "utf8" });
  const cicdParameters: CicdParameters = JSON.parse(cicdParametersJson);

  app.setDefaultFunctionProps({
    runtime: "nodejs16.x",
    srcPath: "services",
    bundle: {
      format: "esm",
    },
  });
  app.stack(buildCicdStack(cicdParameters));
}
