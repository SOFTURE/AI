// @ts-check
// The pre-push test gate: `npm run test:changed` (tsx, for the TypeScript import below). The full suite takes about 25 minutes and CI runs it on every pull
// request in shards anyway, so before a push only the tests a branch can break run:
//
// 1. the test files Vitest relates to the files changed since the branch left the main branch (`vitest --changed`:
//    the changed test files and every test that imports a changed file, directly or through other files);
// 2. the repository tests (`tests/repo`), which read files instead of importing them (links, workflows, language).
//
// The full suite runs instead when a changed file can break tests that do not import it (a dependency manifest,
// lockfile, migration, test setup or tool config: the same list the lefthook preset of @softure-ai/config uses), and
// whenever the base cannot be told (no `origin/master`, a git error). A failure never narrows the gate.
import { execFileSync, spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { FULL_SUITE_PATTERNS } from "../tools/config/src/cli/merge-push-scope-command.js";

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
 * @param {string[]} args
 * @returns {string}
 */
function runGit(args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
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
  const fullSuiteFile = findFullSuiteFile(files, FULL_SUITE_PATTERNS);
  if (fullSuiteFile !== undefined) {
    console.log(`Full suite: ${fullSuiteFile} changed since ${MAIN_REF}.`);
    process.exit(runVitest(["run"]));
  }
  console.log(`${files.length} files changed since ${MAIN_REF} (${base.slice(0, 7)}): related tests and tests/repo.`);
  const related = runVitest(["run", "--changed", base, "--passWithNoTests"]);
  if (related !== 0) process.exit(related);
  process.exit(runVitest(["run", "tests/repo"]));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCli();
}
