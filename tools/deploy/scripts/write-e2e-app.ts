// Writes tools/deploy/e2e/app/: what `softure-deploy init` generates for the example app and a release ships to the
// server (the compose file's folder, deploy.sh, deploy.json). The end-to-end test of deploy-app.yml
// (.github/workflows/e2e-deploy.yml, DF-3) deploys these files from the tag, so they must be committed.
// `npm run e2e-app -w @softure-ai/deploy`; tests/e2e-scripts.test.ts fails when the committed copy and init disagree.
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { readAppFacts } from "../src/init/app-facts.js";
import type { InitAnswers } from "../src/init/answers.js";
import { planInitFiles, type PlannedFile } from "../src/init/generate.js";

export const E2E_APP_DIR = join(import.meta.dirname, "..", "e2e", "app");

const EXAMPLE_APP_DIR = join(import.meta.dirname, "..", "..", "..", "examples", "next-app");

/** The answers of the e2e app; the image matches the `image` input of e2e-deploy.yml, in the registry the e2e server
 * runs on its runner (tools/deploy/e2e/start-server.sh). */
export const E2E_ANSWERS: InitAnswers = {
  domain: "deploy-e2e.example.com",
  image: "localhost:5000/softure/ai-deploy-e2e",
  name: "softure-example",
  paths: ["/"],
  www: false,
  env: ["AUTH_SECRET"],
  tables: [],
};

/** A fixed version in the generated headers, so a version bump does not change the committed files. */
const E2E_CLI_VERSION = "0.0.0";

function isShippedToServer(path: string): boolean {
  return path.startsWith("docker/prod/") || path === "docker/server/deploy.sh" || path === "deploy.json";
}

/** The files init writes for the example app that a release ships to the server. */
export function planE2eAppFiles(): PlannedFile[] {
  const facts = readAppFacts(EXAMPLE_APP_DIR);
  if (!facts.ok) throw new Error(`Reading the example app's facts failed: ${facts.problem}`);
  return planInitFiles({ answers: E2E_ANSWERS, facts: facts.facts, cliVersion: E2E_CLI_VERSION }).filter((file) =>
    isShippedToServer(file.path),
  );
}

if (process.argv[1] === import.meta.filename) {
  rmSync(E2E_APP_DIR, { recursive: true, force: true });
  for (const file of planE2eAppFiles()) {
    const target = join(E2E_APP_DIR, file.path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, file.text, { mode: file.mode });
  }
  console.log(`wrote ${E2E_APP_DIR}`);
}
