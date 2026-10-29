// `softure-merge-push-scope`: whether the push of the current branch only merges the already-tested main branch in
// (issue #868). The lefthook preset runs it twice on `pre-push`: `is-merge` as a `skip` condition of the full test job,
// `is-full` as the `skip` condition of the `test-related` job, whose run is `related`.
//
// The scope is `merge` when every new commit of the pushed range `@{push}..HEAD` that is not already on the upstream
// main branch is either a commit touching only `context/` or a merge commit whose other parents are on the main branch,
// at least one such merge is there, and no incoming file is a migration, a dependency manifest or lockfile, a test
// setup or a tool config (a built-in list plus the app's `fullSuiteOn` globs). Anything else is `full`: new code of the
// branch, no upstream, no main branch on the remote, a git error. A failure never skips a gate.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CONTEXT_FOLDER, runGitCommand, type RunGit } from "./context-only-push-command.js";

export type MergePushScope =
  | { scope: "merge"; mainRef: string; branchFiles: string[] }
  | { scope: "full"; reason: string };

/** The key of an app's `package.json` that holds its own settings of this package. */
export const PACKAGE_JSON_KEY = "@softure-ai/config";

/** Incoming files that can break what the branch's related tests would not catch: run the full suite. */
export const FULL_SUITE_PATTERNS: readonly RegExp[] = [
  // Migrations and schemas.
  /(^|\/)migrations?\//,
  /\.sql$/,
  /(^|\/)prisma\//,
  /(^|\/)drizzle\//,
  // Dependency manifests, lockfiles, runtime pins.
  /(^|\/)package\.json$/,
  /(^|\/)(package-lock\.json|npm-shrinkwrap\.json|yarn\.lock|pnpm-lock\.yaml|pnpm-workspace\.yaml|bun\.lockb?)$/,
  /(^|\/)\.(npmrc|nvmrc|node-version|yarnrc(\.yml)?)$/,
  // Test setup.
  /(^|\/)(vitest|vite|playwright)\.(config|workspace|setup)\.[cm]?[jt]sx?$/,
  /(^|\/)vitest\.(config|workspace)\.json$/,
  /(^|\/)(setup-?tests|test-?setup|global-?setup|global-?teardown)\.[cm]?[jt]sx?$/i,
  /(^|\/)[^/]*\.setup\.[cm]?[jt]sx?$/,
  // Tool config.
  /(^|\/)tsconfig[^/]*\.json$/,
  /(^|\/)eslint\.config\.[cm]?[jt]s$/,
  /(^|\/)\.eslintrc[^/]*$/,
  /(^|\/)lefthook[^/]*\.ya?ml$/,
  /(^|\/)(next|babel|postcss|tailwind|svelte|astro|nuxt)\.config\.[cm]?[jt]s$/,
  /(^|\/)\.babelrc[^/]*$/,
  /(^|\/)\.env[^/]*$/,
];

/** A glob of the app's `fullSuiteOn` as a regular expression: `**` any folders, `*` within one name, `?` one char. */
export function globToRegExp(glob: string): RegExp {
  let source = "";
  for (let index = 0; index < glob.length; index += 1) {
    const char = glob[index] ?? "";
    if (char === "*" && glob[index + 1] === "*") {
      const isFolders = glob[index + 2] === "/";
      source += isFolders ? "(?:.*/)?" : ".*";
      index += isFolders ? 2 : 1;
    } else if (char === "*") {
      source += "[^/]*";
    } else if (char === "?") {
      source += "[^/]";
    } else {
      source += char.replace(/[.+^${}()|[\]\\]/g, "\\$&");
    }
  }
  return new RegExp(`^${source}$`);
}

function readJsonObject(path: string): Record<string, unknown> | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
  return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
}

/** The app's own full-suite globs: `package.json` → `"@softure-ai/config": { "fullSuiteOn": ["db/**"] }`. */
export function readAppFullSuitePatterns(root: string): RegExp[] {
  const settings = readJsonObject(join(root, "package.json"))?.[PACKAGE_JSON_KEY];
  if (typeof settings !== "object" || settings === null) return [];
  const globs = (settings as Record<string, unknown>).fullSuiteOn;
  if (!Array.isArray(globs)) return [];
  return globs.filter((glob): glob is string => typeof glob === "string" && glob !== "").map(globToRegExp);
}

/** `mainBranch` of the SOFTURE workflow config, when the app has one. */
export function readWorkflowMainBranch(root: string): string | null {
  const mainBranch = readJsonObject(join(root, "context/workflow.json"))?.mainBranch;
  return typeof mainBranch === "string" && mainBranch !== "" ? mainBranch : null;
}

function splitLines(output: string): string[] {
  return output.split("\n").map((line) => line.trim()).filter((line) => line !== "");
}

function splitNul(output: string): string[] {
  return output.split("\0").filter((file) => file !== "");
}

function hasRef(ref: string, cwd: string, runGit: RunGit): boolean {
  try {
    runGit(["rev-parse", "--verify", "--quiet", `${ref}^{commit}`], cwd);
    return true;
  } catch {
    return false;
  }
}

/** The upstream main branch as `<remote>/<branch>`: the workflow's `mainBranch`, the remote's HEAD, `main`, `master`. */
function findMainRef(remote: string, root: string, runGit: RunGit): string | null {
  const configured = readWorkflowMainBranch(root);
  if (configured !== null) return hasRef(`${remote}/${configured}`, root, runGit) ? `${remote}/${configured}` : null;
  try {
    const head = runGit(["symbolic-ref", "--quiet", "--short", `refs/remotes/${remote}/HEAD`], root).trim();
    if (head !== "") return head;
  } catch {
    // No remote HEAD recorded (a clone made with --single-branch, a remote added by hand): try the usual names.
  }
  return ["main", "master"].map((name) => `${remote}/${name}`).find((ref) => hasRef(ref, root, runGit)) ?? null;
}

function classifyRange(cwd: string, runGit: RunGit): MergePushScope {
  let pushRef: string;
  try {
    pushRef = runGit(["rev-parse", "--abbrev-ref", "@{push}"], cwd).trim();
  } catch {
    return { scope: "full", reason: "the branch has no upstream" };
  }
  const root = runGit(["rev-parse", "--show-toplevel"], cwd).trim();
  const remote = pushRef.split("/")[0] ?? "";
  const mainRef = findMainRef(remote, root, runGit);
  if (mainRef === null) return { scope: "full", reason: `no main branch found on ${remote}` };

  // The branch's own new commits: pushed range minus what the main branch already has. Lines are `<sha> <parents…>`.
  const commits = splitLines(runGit(["rev-list", "--parents", "HEAD", "^@{push}", `^${mainRef}`], root)).map((line) =>
    line.split(" "),
  );
  if (commits.length === 0) return { scope: "full", reason: "the push brings no commit of the branch" };

  let mergeCount = 0;
  for (const [sha = "", firstParent, ...otherParents] of commits) {
    if (firstParent === undefined) return { scope: "full", reason: `${sha} is a root commit` };
    if (otherParents.length > 0) {
      for (const parent of otherParents) {
        try {
          runGit(["merge-base", "--is-ancestor", parent, mainRef], root);
        } catch {
          return { scope: "full", reason: `merge ${sha.slice(0, 7)} brings in commits that are not on ${mainRef}` };
        }
      }
      mergeCount += 1;
      continue;
    }
    const files = splitNul(runGit(["diff-tree", "--no-commit-id", "--name-only", "-r", "-z", sha], root));
    const codeFile = files.find((file) => !file.startsWith(CONTEXT_FOLDER));
    if (codeFile !== undefined) return { scope: "full", reason: `${sha.slice(0, 7)} changes ${codeFile}` };
  }
  if (mergeCount === 0) return { scope: "full", reason: `the push merges nothing from ${mainRef}` };

  const patterns = [...FULL_SUITE_PATTERNS, ...readAppFullSuitePatterns(root)];
  const incoming = splitNul(runGit(["diff", "--name-only", "-z", "@{push}", "HEAD"], root));
  const fullSuiteFile = incoming.find((file) => patterns.some((pattern) => pattern.test(file)));
  if (fullSuiteFile !== undefined) return { scope: "full", reason: `the merge brings in ${fullSuiteFile}` };

  const base = runGit(["merge-base", mainRef, "HEAD"], root).trim();
  const branchFiles = splitNul(runGit(["diff", "--name-only", "--diff-filter=d", "-z", base, "HEAD"], root));
  return { scope: "merge", mainRef, branchFiles };
}

export function getMergePushScope(cwd: string, runGit: RunGit = runGitCommand): MergePushScope {
  try {
    return classifyRange(cwd, runGit);
  } catch (error) {
    // A git failure must never skip a gate.
    return { scope: "full", reason: `git failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export type RunCommand = (command: string, args: readonly string[], cwd: string) => number;

/** Runs a command with the terminal attached; its exit code (1 when it could not start). */
export function runAttachedCommand(command: string, args: readonly string[], cwd: string): number {
  try {
    execFileSync(command, args, { cwd, stdio: "inherit" });
    return 0;
  } catch (error) {
    const status = (error as { status?: unknown }).status;
    return typeof status === "number" ? status : 1;
  }
}

export const DEFAULT_RELATED_COMMAND: readonly string[] = ["npx", "vitest", "related", "--run", "--passWithNoTests"];

export interface MergePushScopeOptions {
  cwd: string;
  runGit?: RunGit;
  runCommand?: RunCommand;
  log?: (line: string) => void;
}

const USAGE = "usage: softure-merge-push-scope is-merge | is-full | related [-- <test command…>]";

/** The bin: `is-merge` and `is-full` answer through the exit code; `related` runs the branch's related tests. */
export function runMergePushScope(argv: readonly string[], options: MergePushScopeOptions): number {
  const { cwd, runGit = runGitCommand, runCommand = runAttachedCommand, log = console.error } = options;
  const [mode, ...rest] = argv;
  if (mode !== "is-merge" && mode !== "is-full" && mode !== "related") {
    log(USAGE);
    return 2;
  }
  const result = getMergePushScope(cwd, runGit);
  if (mode === "is-merge") return result.scope === "merge" ? 0 : 1;
  if (mode === "is-full") return result.scope === "full" ? 0 : 1;

  if (result.scope === "full") {
    log(`softure-merge-push-scope: full suite (${result.reason}); the test job runs it.`);
    return 0;
  }
  if (result.branchFiles.length === 0) {
    log(`softure-merge-push-scope: the branch changes no file against ${result.mainRef}; no related tests to run.`);
    return 0;
  }
  const custom = rest[0] === "--" ? rest.slice(1) : rest;
  const [command = "", ...args] = custom.length > 0 ? custom : DEFAULT_RELATED_COMMAND;
  log(`softure-merge-push-scope: merge of ${result.mainRef}; tests related to ${result.branchFiles.length} branch file(s).`);
  return runCommand(command, [...args, ...result.branchFiles], cwd);
}
