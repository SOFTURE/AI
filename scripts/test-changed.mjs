// @ts-check
// The pre-push test gate: `npm run test:changed` (tsx, for the TypeScript import below). The full suite takes about 25 minutes and CI runs it on every pull
// request in shards anyway, so before a push only the tests a branch can break run:
//
// 1. the test files Vitest relates to the files changed since the branch left the main branch (`vitest --changed`:
//    the changed test files and every test that imports a changed file, directly or through other files);
// 2. the repository tests (`tests/repo`), which read files instead of importing them (links, workflows, language).
//
// When a changed file can break tests that do not import it (a dependency manifest, lockfile, migration, test setup or
// tool config: the same list the lefthook preset of @softure-ai/config uses), the tests run in the scope the pull
// request's CI test job runs (scripts/ci/affected.mjs, getTestScope): the folders of the packages the change reaches,
// their dependents and tests/. A release's version bump so runs the bumped package and its dependents, not the whole
// suite. The whole suite runs when that scope is everything (a shared root file, a repository tool in the lockfile)
// and whenever the base cannot be told (no `origin/master`, a git error, an unreadable lockfile). A failure never
// narrows the gate.
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { FULL_SUITE_PATTERNS } from "../tools/config/src/cli/merge-push-scope-command.js";
import { findWorkspaces } from "./build-workspaces.mjs";
import { LOCKFILE, getTestScope } from "./ci/affected.mjs";
import { getLockfileReach } from "./ci/lockfile-changes.mjs";

/**
 * @typedef {import("./build-workspaces.mjs").WorkspacePackage} WorkspacePackage
 * @typedef {{ kind: "related" } | { kind: "all", reason: string } | { kind: "paths", paths: string[], file: string }} PushTestScope
 */

/** The ref the branch is compared with. */
export const MAIN_REF = "origin/master";

/**
 * Whether a changed file needs the full suite. The patterns are those of the lefthook preset
 * (tools/config/src/cli/merge-push-scope-command.ts), passed in so a test can name its own.
 * @param {string[]} files changed files, relative to the repository root
 * @param {readonly RegExp[]} patterns
 * @returns {string | undefined} the first file that needs the full suite
 */
export function findFullSuiteFile(files, patterns) {
  return files.find((file) => patterns.some((pattern) => pattern.test(file)));
}

/**
 * Which tests a push needs: the related tests, the CI test scope of a change that touches a full-suite file, or the
 * whole suite.
 * @param {{ files: string[], packages: WorkspacePackage[], readBaseLockfile: () => unknown, readLockfile: () => unknown }} options
 *   `readBaseLockfile` reads package-lock.json at the merge base and may throw; it is read only when the lockfile changed.
 * @returns {PushTestScope}
 */
export function getPushTestScope({ files, packages, readBaseLockfile, readLockfile }) {
  const file = findFullSuiteFile(files, FULL_SUITE_PATTERNS);
  if (file === undefined) return { kind: "related" };
  try {
    const lockfile = files.includes(LOCKFILE)
      ? getLockfileReach({ before: readBaseLockfile(), after: readLockfile(), workspaces: packages })
      : undefined;
    const scope = getTestScope({ changed: { kind: "files", files, lockfile }, packages });
    return scope.kind === "all" ? { kind: "all", reason: `${file} changed: ${scope.reason}` } : { ...scope, file };
  } catch (error) {
    return { kind: "all", reason: `${file} changed and its reach cannot be told (${String(error)})` };
  }
}

/**
 * @param {string[]} args
 * @returns {string}
 */
function runGit(args) {
  // The lockfile at the base is read through git too: tens of megabytes.
  return execFileSync("git", args, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 }).trim();
}

/**
 * @param {string[]} args
 * @returns {number}
 */
function runVitest(args) {
  console.log(`\n> vitest ${args.join(" ")}`);
  const result = spawnSync("npx", ["vitest", ...args], { stdio: "inherit" });
  return result.status ?? 1;
}

function runCli() {
  /** @type {string} */
  let base;
  /** @type {string[]} */
  let files;
  try {
    base = runGit(["merge-base", "HEAD", MAIN_REF]);
    files = runGit(["diff", "--name-only", base]).split("\n").filter((file) => file !== "");
  } catch (error) {
    console.log(`Full suite: the changes since ${MAIN_REF} cannot be listed (${String(error)}).`);
    process.exit(runVitest(["run"]));
  }
  const root = fileURLToPath(new URL("../", import.meta.url));
  const scope = getPushTestScope({
    files,
    packages: findWorkspaces(root),
    readBaseLockfile: () => /** @type {unknown} */ (JSON.parse(runGit(["show", `${base}:${LOCKFILE}`]))),
    readLockfile: () => /** @type {unknown} */ (JSON.parse(readFileSync(resolve(root, LOCKFILE), "utf8"))),
  });
  if (scope.kind === "all") {
    console.log(`Full suite: ${scope.reason}.`);
    process.exit(runVitest(["run"]));
  }
  if (scope.kind === "paths") {
    console.log(`${scope.file} changed since ${MAIN_REF}: the tests of the packages the change reaches, as CI runs them.`);
    process.exit(runVitest(["run", "--passWithNoTests", ...scope.paths]));
  }
  console.log(`${files.length} files changed since ${MAIN_REF} (${base.slice(0, 7)}): related tests and tests/repo.`);
  const related = runVitest(["run", "--changed", base, "--passWithNoTests"]);
  if (related !== 0) process.exit(related);
  process.exit(runVitest(["run", "tests/repo"]));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCli();
}
