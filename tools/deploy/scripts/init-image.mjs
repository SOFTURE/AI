// @ts-check
// Builds the example app's image from the files `softure-deploy init` generates (DP-5): `npm run e2e:deploy-init`
// at the repository root, and the `deploy-init` job of .github/workflows/e2e.yml. Needs `npm run build` first.
//
// The example installs the workspace packages through `file:../../…`, which a standalone build context cannot
// reach, so it is staged as a standalone app:
//
// 1. its tracked files are copied to a temp folder, without its own Dockerfile, container compose and lockfile;
// 2. the workspace packages it depends on are packed into vendor/ and its dependencies point at the tarballs;
// 3. a fresh lockfile is written, then the built CLI runs `init` there;
// 4. the generated compose file is validated by `docker compose config`, deploy.sh by `bash -n` (and shellcheck
//    when installed);
// 5. `docker build` builds the generated Dockerfile, and the image is checked for the server and the migrate step.
//
// `--keep` leaves the staged folder for a look. NODE_IMAGE names another copy of node:22-alpine (Docker Hub limits
// anonymous pulls), e.g. mirror.gcr.io/library/node:22-alpine.
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const EXAMPLE = "examples/next-app";
const CLI = join(REPO_ROOT, "tools/deploy/dist/cli/main.js");
const IMAGE_TAG = "softure-deploy-init:local";
/** The example's own container files and lockfile: init writes the first, npm the last. */
const LEFT_OUT = new Set(["Dockerfile", "compose.container.yaml", "package-lock.json"]);
const SHOULD_KEEP = process.argv.includes("--keep");

/**
 * Runs a command and returns its stdout; throws with its output when it fails.
 * @param {string} command
 * @param {string[]} args
 * @param {{ cwd?: string, env?: NodeJS.ProcessEnv, quiet?: boolean }} [options]
 */
function run(command, args, options = {}) {
  console.log(`\n> ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? REPO_ROOT,
    encoding: "utf8",
    env: options.env ?? process.env,
    stdio: options.quiet ? "pipe" : ["ignore", "pipe", "inherit"],
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error) throw new Error(`Running ${command} failed: ${result.error.message}`);
  if (!options.quiet && result.stdout) process.stdout.write(result.stdout);
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} exited with ${String(result.status)}\n${result.stderr ?? ""}`);
  }
  return result.stdout;
}

/**
 * @param {boolean} condition
 * @param {string} message
 */
function check(condition, message) {
  if (!condition) throw new Error(`deploy-init check failed: ${message}`);
  console.log(`ok: ${message}`);
}

/**
 * @param {string} text
 * @returns {unknown}
 */
function parseJson(text) {
  return JSON.parse(text);
}

/** @param {string} appDir */
function copyTrackedFiles(appDir) {
  const files = run("git", ["ls-files", "-z", EXAMPLE], { quiet: true }).split("\0").filter(Boolean);
  for (const file of files) {
    const relative = file.slice(EXAMPLE.length + 1);
    if (LEFT_OUT.has(relative)) continue;
    const target = join(appDir, relative);
    mkdirSync(dirname(target), { recursive: true });
    cpSync(join(REPO_ROOT, file), target);
  }
  return files.length;
}

/**
 * Packs every `file:` dependency into vendor/ and points the dependency at its tarball.
 * @param {string} appDir
 */
function vendorWorkspacePackages(appDir) {
  const pkgPath = join(appDir, "package.json");
  const pkg = /** @type {{ dependencies?: Record<string, string>, devDependencies?: Record<string, string> }} */ (
    parseJson(readFileSync(pkgPath, "utf8"))
  );
  const vendorDir = join(appDir, "vendor");
  mkdirSync(vendorDir, { recursive: true });
  let packed = 0;
  for (const group of [pkg.dependencies, pkg.devDependencies]) {
    for (const [name, spec] of Object.entries(group ?? {})) {
      if (!spec.startsWith("file:")) continue;
      const folder = resolve(REPO_ROOT, EXAMPLE, spec.slice("file:".length));
      const output = run("npm", ["pack", folder, "--pack-destination", vendorDir, "--json", "--silent"], { quiet: true });
      const [info] = /** @type {{ filename: string }[]} */ (parseJson(output));
      if (!info) throw new Error(`npm pack ${folder} reported no tarball`);
      /** @type {Record<string, string>} */ (group)[name] = `file:vendor/${info.filename}`;
      packed += 1;
    }
  }
  writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
  return packed;
}

/** @param {string} appDir */
function validateGeneratedFiles(appDir) {
  const placeholders = {
    ...process.env,
    TAG: "ci",
    POSTGRES_PASSWORD: "placeholder",
    SOFTURE_MIGRATOR_PASSWORD: "placeholder",
    SOFTURE_APP_PASSWORD: "placeholder",
    AUTH_SECRET: "placeholder",
  };
  run("docker", ["compose", "--file", "docker/prod/docker-compose.yml", "config", "--quiet"], { cwd: appDir, env: placeholders });
  check(true, "docker compose accepts the generated docker/prod/docker-compose.yml");
  run("bash", ["-n", "docker/server/deploy.sh"], { cwd: appDir });
  check(true, "bash parses the generated docker/server/deploy.sh");
  const shellcheck = spawnSync("shellcheck", ["--version"], { encoding: "utf8" });
  if (shellcheck.status === 0) {
    run("shellcheck", ["docker/server/deploy.sh"], { cwd: appDir });
    check(true, "shellcheck finds nothing in deploy.sh");
  } else {
    console.log("skip: shellcheck is not installed");
  }
}

function main() {
  check(existsSync(CLI), `the deploy CLI is built (${CLI}; run npm run build)`);
  const stage = mkdtempSync(join(tmpdir(), "softure-deploy-init-"));
  const appDir = join(stage, "app");
  try {
    const copied = copyTrackedFiles(appDir);
    const packed = vendorWorkspacePackages(appDir);
    check(packed > 0, `the staged app depends on ${packed} packed workspace packages (${copied} tracked files copied)`);
    run("npm", ["install", "--package-lock-only", "--no-audit", "--no-fund", "--ignore-scripts"], { cwd: appDir });

    const output = run("node", [
      CLI, "init", `--dir=${appDir}`, "--domain=example.com", "--image=ghcr.io/softure/example-app",
      "--env=AUTH_SECRET", "--tables=guestbook.entries",
    ]);
    check(output.includes("wrote   Dockerfile") && output.includes("kept    scripts/migrate.ts"), "init wrote the Dockerfile and kept the app's own scripts/migrate.ts");
    check(output.includes("database part on"), "init turned the database part on from @softure-ai/db in package.json");

    validateGeneratedFiles(appDir);

    const nodeImage = process.env.NODE_IMAGE ?? "node:22-alpine";
    run("docker", ["build", "--build-arg", `NODE_IMAGE=${nodeImage}`, "--tag", IMAGE_TAG, "."], { cwd: appDir });
    check(true, "docker build built the generated Dockerfile");
    run("docker", ["run", "--rm", "--entrypoint", "ls", IMAGE_TAG, "/app/server.js", "/app/migrate.mjs", "/app/softure-migrations"]);
    check(true, "the image holds the standalone server, migrate.mjs and the exported migrations");
  } finally {
    if (SHOULD_KEEP) console.log(`\nkept the staged app in ${appDir}`);
    else rmSync(stage, { recursive: true, force: true });
  }
}

try {
  main();
  console.log("\ndeploy-init image build passed");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
