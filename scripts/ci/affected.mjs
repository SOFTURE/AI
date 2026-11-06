// @ts-check
// Which slow CI areas a change reaches: `node scripts/ci/affected.mjs` in the `changes` job of ci.yml and e2e.yml.
//
// The changed files come from the GitHub API (a pull request's files, or the compare of a push to master). A file in
// a workspace package reaches that package and every workspace package that depends on it; a shared root file (the
// lockfile, a root config, a script, a composite action, the workflow itself) reaches every area. A manual or
// scheduled run, a list the API cut short, or any failure to list the files also reaches every area: a skipped area
// must never hide a red one. The areas are written to $GITHUB_OUTPUT as `<area>=true|false`.
import { execFileSync } from "node:child_process";
import { appendFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { findWorkspaces, getDependencyNames } from "../build-workspaces.mjs";

/**
 * @typedef {import("../build-workspaces.mjs").WorkspacePackage} WorkspacePackage
 * @typedef {{ name: string, packages: string[], paths: string[], sharedPaths?: string[] }} Area
 *   `sharedPaths` replaces SHARED_PATHS for an area that must not run on every shared change (the Stripe sandbox
 *   payment, which pays in a real account: a lockfile or root config change is no reason to).
 * @typedef {{ kind: "files", files: string[] } | { kind: "all", reason: string }} ChangedFiles
 */

/** The GitHub API lists at most this many files of a compare; a longer change reaches every area. */
export const COMPARE_FILE_LIMIT = 300;
/** The GitHub API lists at most this many files of a pull request. */
export const PULL_REQUEST_FILE_LIMIT = 3000;

/**
 * Files outside every workspace package that every area builds on. A folder ends with a slash.
 */
export const SHARED_PATHS = [
  "package.json",
  "package-lock.json",
  ".npmrc",
  "tsconfig.json",
  "tsconfig.base.json",
  "vitest.config.mts",
  "eslint.config.mjs",
  "scripts/",
  ".github/actions/",
  ".github/workflows/ci.yml",
  ".github/workflows/e2e.yml",
];

/**
 * The workspace packages with the dependencies they ship (dependencies, peer and optional): what a packed package
 * brings into an app. Development dependencies only serve a package's own tests, which the test job runs anyway.
 * @param {string} root repository root
 * @returns {WorkspacePackage[]}
 */
export function findRuntimeWorkspaces(root) {
  return findWorkspaces(root).map((pkg) => {
    const manifest = readManifest(root, `${pkg.dir}/package.json`);
    const dependencyNames = [
      "dependencies",
      "peerDependencies",
      "optionalDependencies",
    ].flatMap((field) => {
      const dependencies = manifest[field];
      return typeof dependencies === "object" && dependencies !== null
        ? Object.keys(dependencies)
        : [];
    });
    return { ...pkg, dependencyNames };
  });
}

/**
 * @param {string} root repository root
 * @param {string} path a package.json relative to the root
 * @returns {Record<string, unknown>}
 */
function readManifest(root, path) {
  /** @type {unknown} */
  const manifest = JSON.parse(readFileSync(resolve(root, path), "utf8"));
  if (
    typeof manifest !== "object" ||
    manifest === null ||
    Array.isArray(manifest)
  ) {
    throw new Error(`Reading ${path}: not a JSON object`);
  }
  return /** @type {Record<string, unknown>} */ (manifest);
}

/**
 * The workspace packages the example app installs (`file:` dependencies of examples/next-app).
 * @param {string} root repository root
 * @returns {string[]}
 */
function readExamplePackages(root) {
  return getDependencyNames(
    readManifest(root, "examples/next-app/package.json"),
  ).filter((name) => name.startsWith("@softure-ai/"));
}

/**
 * The slow areas of ci.yml and e2e.yml. An area is reached by a change to one of its packages (or a workspace
 * package any of them depends on) or to one of its paths.
 * @param {string} root repository root
 * @returns {Area[]}
 */
export function getAreas(root) {
  const examplePackages = readExamplePackages(root);
  return [
    { name: "example-app", packages: examplePackages, paths: ["examples/"] },
    {
      name: "marketing-kit",
      packages: ["@softure-ai/marketing-kit"],
      paths: [],
    },
    // The converge script runs tools/deploy/scripts/e2e-app-vars.ts.
    {
      name: "host",
      packages: ["@softure-ai/host", "@softure-ai/deploy"],
      paths: [],
    },
    // A real payment in Stripe's sandbox (e2e.yml, Stripe sandbox payment): only the billing module, the app's payment
    // pages and webhook, and the test itself reach it, not its dependencies or a shared root file such as the
    // lockfile. The nightly scheduled run covers the rest, and a change in Stripe's sandbox.
    {
      name: "stripe-sandbox",
      packages: [],
      paths: [
        "modules/billing/",
        "examples/next-app/app/payment/",
        "examples/next-app/app/api/billing/",
        "examples/next-app/e2e/billing-checkout.stripe-sandbox.spec.ts",
        "examples/next-app/playwright.stripe-sandbox.config.ts",
      ],
      sharedPaths: [".github/workflows/e2e.yml", ".github/actions/"],
    },
    // The init image packs the example app with the workspace packages it installs.
    {
      name: "deploy",
      packages: ["@softure-ai/deploy", ...examplePackages],
      paths: ["examples/"],
    },
  ];
}

/**
 * @param {string} file
 * @param {string} path a file, or a folder ending with a slash
 */
function isUnder(file, path) {
  return path.endsWith("/") ? file.startsWith(path) : file === path;
}

/**
 * Every workspace package `names` depend on, the names included.
 * @param {string[]} names
 * @param {WorkspacePackage[]} packages
 * @returns {Set<string>}
 */
export function getDependencyClosure(names, packages) {
  const byName = new Map(packages.map((pkg) => [pkg.name, pkg]));
  /** @type {Set<string>} */
  const closure = new Set();
  const queue = [...names];
  while (queue.length > 0) {
    const name = queue.pop();
    if (name === undefined || closure.has(name)) continue;
    closure.add(name);
    queue.push(
      ...(byName
        .get(name)
        ?.dependencyNames.filter((dependency) => byName.has(dependency)) ?? []),
    );
  }
  return closure;
}

/**
 * Which areas the changed files reach.
 * @param {{ changed: ChangedFiles, areas: Area[], packages: WorkspacePackage[] }} options
 * @returns {Record<string, boolean>}
 */
export function getAffectedAreas({ changed, areas, packages }) {
  const files = changed.kind === "files" ? changed.files : [];
  /** @type {Record<string, boolean>} */
  const affected = {};
  for (const area of areas) {
    const reachesAll =
      changed.kind === "all" ||
      files.some((file) =>
        (area.sharedPaths ?? SHARED_PATHS).some((path) => isUnder(file, path)),
      );
    const closure = getDependencyClosure(area.packages, packages);
    const dirs = packages
      .filter((pkg) => closure.has(pkg.name))
      .map((pkg) => `${pkg.dir}/`);
    affected[area.name] =
      reachesAll ||
      files.some((file) =>
        [...dirs, ...area.paths].some((path) => isUnder(file, path)),
      );
  }
  return affected;
}

/**
 * Lists the files of the run's change through the GitHub CLI, or says why every area runs.
 * @param {NodeJS.ProcessEnv} env
 * @returns {ChangedFiles}
 */
function listChangedFiles(env) {
  const repository = env.GITHUB_REPOSITORY ?? "";
  const gh = (/** @type {string[]} */ args) =>
    execFileSync("gh", ["api", ...args], { encoding: "utf8" })
      .split("\n")
      .filter((line) => line !== "");
  try {
    /** @type {{ pull_request?: { number?: number }, before?: string, after?: string }} */
    const event = readManifest("/", env.GITHUB_EVENT_PATH ?? "");
    if (env.GITHUB_EVENT_NAME === "pull_request") {
      const files = gh([
        "--paginate",
        `repos/${repository}/pulls/${String(event.pull_request?.number)}/files`,
        "--jq",
        ".[].filename",
      ]);
      return files.length >= PULL_REQUEST_FILE_LIMIT
        ? { kind: "all", reason: `${files.length} files` }
        : { kind: "files", files };
    }
    if (
      env.GITHUB_EVENT_NAME === "push" &&
      typeof event.before === "string" &&
      !/^0+$/.test(event.before)
    ) {
      const files = gh([
        `repos/${repository}/compare/${event.before}...${String(event.after)}`,
        "--jq",
        ".files[].filename",
      ]);
      return files.length >= COMPARE_FILE_LIMIT
        ? { kind: "all", reason: `${files.length} files` }
        : { kind: "files", files };
    }
    return {
      kind: "all",
      reason: `a ${env.GITHUB_EVENT_NAME ?? "unknown"} run`,
    };
  } catch (error) {
    return {
      kind: "all",
      reason: `listing the changed files failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

function runCli() {
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const changed = listChangedFiles(process.env);
  console.log(
    changed.kind === "all"
      ? `Every area runs: ${changed.reason}.`
      : `${changed.files.length} changed files.`,
  );
  const affected = getAffectedAreas({
    changed,
    areas: getAreas(root),
    packages: findRuntimeWorkspaces(root),
  });
  const lines = Object.entries(affected).map(
    ([name, value]) => `${name}=${String(value)}`,
  );
  console.log(lines.join("\n"));
  if (process.env.GITHUB_OUTPUT)
    appendFileSync(process.env.GITHUB_OUTPUT, `${lines.join("\n")}\n`);
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  runCli();
}
