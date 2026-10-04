// @ts-check
// The whole e2e run from a clean state: `npm run e2e` at the repository root.
//
// 1. builds every workspace package (the app installs their packed `dist/`, not their sources);
// 2. reinstalls the app, so it gets fresh packed copies (`install-links` in .npmrc);
// 3. starts Postgres from compose.yaml unless DATABASE_URL points at one already;
// 4. migrates, publishes the blog's fixture texts and builds the app (`next build` typechecks it),
//    then runs Playwright against `next start`.
//
// Browsers: Playwright's own Chromium is installed unless PLAYWRIGHT_CHROMIUM_PATH names one.
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const APP_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = resolve(APP_DIR, "../..");

/**
 * Runs a command with inherited output and stops the script when it fails.
 * @param {string} command
 * @param {string[]} args
 * @param {string} cwd
 */
function run(command, args, cwd) {
  console.log(`\n> ${[command, ...args].join(" ")}  (${cwd === REPO_ROOT ? "repository root" : "examples/next-app"})`);
  const result = spawnSync(command, args, { cwd, stdio: "inherit", shell: process.platform === "win32" });
  if (result.error) {
    throw new Error(`Running ${command} ${args.join(" ")} failed: ${result.error.message}`);
  }
  if (result.status !== 0) {
    console.error(`e2e: "${command} ${args.join(" ")}" exited with ${String(result.status)}`);
    process.exit(result.status ?? 1);
  }
}

run("npm", ["run", "build"], REPO_ROOT);
run("npm", ["ci"], APP_DIR);
if (!process.env.PLAYWRIGHT_CHROMIUM_PATH) {
  run("npx", ["playwright", "install", "chromium"], APP_DIR);
}
if (!process.env.DATABASE_URL) {
  run("docker", ["compose", "up", "--detach", "--wait"], APP_DIR);
}
run("npm", ["run", "migrate"], APP_DIR);
run("npm", ["run", "blog:fixtures"], APP_DIR);
run("npm", ["run", "build"], APP_DIR);
run("npm", ["run", "e2e"], APP_DIR);
