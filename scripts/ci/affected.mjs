// @ts-check
// What a change reaches in CI: `node scripts/ci/affected.mjs` in the `changes` job of ci.yml and e2e.yml.
//
// The changed files come from the GitHub API (a pull request's files, or the compare of a push to master). A file in
// a workspace package reaches that package and every workspace package that depends on it. A change of
// package-lock.json reaches only the packages whose installed tree changed (scripts/ci/lockfile-changes.mjs): a
// release's version bump reaches the bumped package and its dependents, not every package. A shared root file (a root
// config, a script, a composite action, the workflow itself) reaches everything. A manual or scheduled run, a list the
// API cut short, or any failure to list the files or read the lockfile also reaches everything: a skipped job must
// never hide a red one.
//
// Written to $GITHUB_OUTPUT: the slow areas as `<area>=true|false`, and `test-paths`, the test paths of the packages a
// pull request reaches (their folders and the repository tests in tests/), empty when the whole suite must run.
import { execFileSync } from "node:child_process";
import { appendFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { findWorkspaces, getDependencyNames } from "../build-workspaces.mjs";
import { getLockfileReach } from "./lockfile-changes.mjs";

/**
 * @typedef {import("../build-workspaces.mjs").WorkspacePackage} WorkspacePackage
 * @typedef {import("./lockfile-changes.mjs").LockfileReach} LockfileReach
 * @typedef {{ name: string, packages: string[], paths: string[] }} Area
 * @typedef {{ kind: "files", files: string[], lockfile?: LockfileReach } | { kind: "all", reason: string }} ChangedFiles
 *   `lockfile` says which packages a change of package-lock.json reaches; without it such a change reaches everything.
 * @typedef {{ kind: "all", reason: string } | { kind: "paths", paths: string[] }} TestScope
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

/** The root lockfile: it reaches the packages whose entries changed, not every package. */
export const LOCKFILE = "package-lock.json";

/** The repository tests (tests/repo and the other root tests): they read files across the tree, so they always run. */
export const ROOT_TEST_PATH = "tests/";

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
    // The off-site backup's run on Postgres 17 and MinIO (e2e.yml backup-integration).
    {
      name: "backup",
      packages: ["@softure-ai/backup"],
      paths: [],
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
 * Whether the change reaches everything: a run without a file list, a shared root file, or a lockfile change whose
 * reach is unknown or total.
 * @param {ChangedFiles} changed
 * @returns {boolean}
 */
function isReachingAll(changed) {
  if (changed.kind === "all") return true;
  if (
    changed.files.some((file) =>
      SHARED_PATHS.some((path) => isUnder(file, path)),
    )
  )
    return true;
  return (
    changed.files.includes(LOCKFILE) &&
    (changed.lockfile === undefined || changed.lockfile.kind === "all")
  );
}

/**
 * The workspace packages the lockfile change reaches by name (none when the lockfile did not change).
 * @param {ChangedFiles} changed
 * @returns {Set<string>}
 */
function getLockfilePackageNames(changed) {
  return new Set(
    changed.kind === "files" &&
      changed.files.includes(LOCKFILE) &&
      changed.lockfile?.kind === "packages"
      ? changed.lockfile.names
      : [],
  );
}

/**
 * Whether any of `names` (workspace packages with their dependencies) changed: a file in its folder, or its lockfile
 * entries.
 * @param {{ names: string[], changed: ChangedFiles, packages: WorkspacePackage[], paths?: string[] }} options
 * @returns {boolean}
 */
function isReached({ names, changed, packages, paths = [] }) {
  const files = changed.kind === "files" ? changed.files : [];
  const closure = getDependencyClosure(names, packages);
  const lockfileNames = getLockfilePackageNames(changed);
  if ([...closure].some((name) => lockfileNames.has(name))) return true;
  const dirs = packages
    .filter((pkg) => closure.has(pkg.name))
    .map((pkg) => `${pkg.dir}/`);
  return files.some((file) =>
    [...dirs, ...paths].some((path) => isUnder(file, path)),
  );
}

/**
 * Which areas the changed files reach.
 * @param {{ changed: ChangedFiles, areas: Area[], packages: WorkspacePackage[] }} options
 * @returns {Record<string, boolean>}
 */
export function getAffectedAreas({ changed, areas, packages }) {
  const reachesAll = isReachingAll(changed);
  /** @type {Record<string, boolean>} */
  const affected = {};
  for (const area of areas) {
    affected[area.name] =
      reachesAll ||
      isReached({ names: area.packages, changed, packages, paths: area.paths });
  }
  return affected;
}

/**
 * Which tests a change needs: the folders of the workspace packages it reaches (with every dependency kind, since a
 * package's tests run its development dependencies too) and the repository tests, or the whole suite.
 * @param {{ changed: ChangedFiles, packages: WorkspacePackage[] }} options
 * @returns {TestScope}
 */
export function getTestScope({ changed, packages }) {
  if (changed.kind === "all") return { kind: "all", reason: changed.reason };
  if (isReachingAll(changed))
    return {
      kind: "all",
      reason: "a shared root file or the repository tools changed",
    };
  const dirs = packages
    .filter((pkg) => isReached({ names: [pkg.name], changed, packages }))
    .map((pkg) => `${pkg.dir}/`);
  return { kind: "paths", paths: [ROOT_TEST_PATH, ...dirs] };
}

/**
 * Which packages the change of package-lock.json reaches: the lockfile at `base` (read through the GitHub API) against
 * the checked-out one. Any failure reaches every package.
 * @param {{ root: string, repository: string, base: string }} options
 * @returns {LockfileReach}
 */
function readLockfileReach({ root, repository, base }) {
  try {
    /** @type {unknown} */
    const before = JSON.parse(
      execFileSync(
        "gh",
        [
          "api",
          "-H",
          "Accept: application/vnd.github.raw+json",
          `repos/${repository}/contents/${LOCKFILE}?ref=${base}`,
        ],
        { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 },
      ),
    );
    /** @type {unknown} */
    const after = JSON.parse(readFileSync(resolve(root, LOCKFILE), "utf8"));
    return getLockfileReach({
      before,
      after,
      workspaces: findWorkspaces(root),
    });
  } catch (error) {
    return {
      kind: "all",
      reason: `reading the lockfile at ${base} failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * The files of a change and, when it changes package-lock.json, the packages that change reaches.
 * @param {{ files: string[], root: string, repository: string, base: string }} options
 * @returns {ChangedFiles}
 */
function describeFiles({ files, root, repository, base }) {
  return files.includes(LOCKFILE)
    ? {
        kind: "files",
        files,
        lockfile: readLockfileReach({ root, repository, base }),
      }
    : { kind: "files", files };
}

/**
 * Lists the files of the run's change through the GitHub CLI, or says why every area runs.
 * @param {NodeJS.ProcessEnv} env
 * @param {string} root repository root
 * @returns {ChangedFiles}
 */
function listChangedFiles(env, root) {
  const repository = env.GITHUB_REPOSITORY ?? "";
  const gh = (/** @type {string[]} */ args) =>
    execFileSync("gh", ["api", ...args], { encoding: "utf8" })
      .split("\n")
      .filter((line) => line !== "");
  try {
    /** @type {{ pull_request?: { number?: number, base?: { sha?: string } }, before?: string, after?: string }} */
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
        : describeFiles({
            files,
            root,
            repository,
            base: String(event.pull_request?.base?.sha),
          });
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
        : describeFiles({ files, root, repository, base: event.before });
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
  const changed = listChangedFiles(process.env, root);
  console.log(
    changed.kind === "all"
      ? `Everything runs: ${changed.reason}.`
      : `${changed.files.length} changed files.`,
  );
  if (changed.kind === "files" && changed.lockfile !== undefined) {
    console.log(
      changed.lockfile.kind === "all"
        ? `The lockfile change reaches every package: ${changed.lockfile.reason}.`
        : `The lockfile change reaches: ${changed.lockfile.names.join(", ") || "no package"}.`,
    );
  }
  const affected = getAffectedAreas({
    changed,
    areas: getAreas(root),
    packages: findRuntimeWorkspaces(root),
  });
  const scope = getTestScope({ changed, packages: findWorkspaces(root) });
  console.log(
    scope.kind === "all"
      ? `Tests: the whole suite (${scope.reason}).`
      : `Tests: ${scope.paths.join(" ")}`,
  );
  const lines = [
    ...Object.entries(affected).map(
      ([name, value]) => `${name}=${String(value)}`,
    ),
    `test-paths=${scope.kind === "all" ? "" : scope.paths.join(" ")}`,
  ];
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
