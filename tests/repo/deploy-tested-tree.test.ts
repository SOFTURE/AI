import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parse } from "yaml";
import { REPO_ROOT } from "./repo-files.js";

interface Step {
  id?: string;
  name?: string;
  uses?: string;
  run?: string;
  with?: Record<string, unknown>;
  env?: Record<string, string>;
}

interface Workflow {
  on: { workflow_call: { inputs: Record<string, { default?: unknown; required?: boolean }>; outputs: Record<string, { value: string }> } };
  permissions: Record<string, string>;
  jobs: Record<string, { permissions: Record<string, string>; outputs: Record<string, string>; steps: Step[] }>;
}

const workflow = parse(readFileSync(join(REPO_ROOT, ".github/workflows/deploy-tested-tree.yml"), "utf8")) as Workflow;
const job = workflow.jobs.tested;
const findStep = job?.steps.find((step) => step.id === "find");
const SCRIPT = findStep?.run ?? "exit 99";

/** A fake gh that answers from files: pulls/<sha>, commits/<pr>, checks/<sha>-<name>, and fails on fail/<sha>. */
const FAKE_GH = `#!/usr/bin/env bash
set -e
[ "$1" = api ] || exit 3
shift
[ "$1" = --paginate ] && shift
path="$1"
case "$path" in
  repos/acme/app/commits/*/pulls)
    sha="\${path#repos/acme/app/commits/}"; sha="\${sha%/pulls}"
    [ -e "$FAKE/fail/$sha" ] && exit 1
    cat "$FAKE/pulls/$sha" 2> /dev/null || true ;;
  repos/acme/app/pulls/*/commits*)
    pr="\${path#repos/acme/app/pulls/}"; pr="\${pr%%/*}"
    [ -e "$FAKE/fail/pr-$pr" ] && exit 1
    cat "$FAKE/commits/$pr" ;;
  repos/acme/app/commits/*/check-runs*)
    sha="\${path#repos/acme/app/commits/}"; sha="\${sha%%/*}"
    name="\${path##*check_name=}"
    cat "$FAKE/checks/$sha-$name" 2> /dev/null || echo 0 ;;
  *) exit 4 ;;
esac
`;

interface Sandbox {
  root: string;
  work: string;
  fake: string;
  bin: string;
}

let box: Sandbox;

function git(...args: string[]): string {
  const result = spawnSync("git", args, {
    cwd: box.work,
    encoding: "utf8",
    env: { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.com", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.com" },
  });
  if (result.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${result.stderr}`);
  return result.stdout.trim();
}

function commitFile(path: string, text: string): string {
  mkdirSync(join(box.work, path, ".."), { recursive: true });
  writeFileSync(join(box.work, path), text);
  git("add", "-A");
  git("commit", "--quiet", "-m", `change ${path}`);
  return git("rev-parse", "HEAD");
}

function fake(path: string, text: string): void {
  mkdirSync(join(box.fake, path, ".."), { recursive: true });
  writeFileSync(join(box.fake, path), text);
}

function run(env: Record<string, string> = {}): { status: number | null; stdout: string; output: Record<string, string> } {
  const outputFile = join(box.root, "output");
  writeFileSync(outputFile, "");
  const result = spawnSync("bash", ["-e", "-c", SCRIPT], {
    cwd: box.work,
    encoding: "utf8",
    env: {
      PATH: `${box.bin}:${process.env.PATH ?? ""}`,
      HOME: box.root,
      GITHUB_OUTPUT: outputFile,
      FAKE: box.fake,
      GH_TOKEN: "token",
      REPOSITORY: "acme/app",
      TAG: "v1",
      CHECK_NAMES: "coverage",
      IGNORE_PREFIXES: "context/",
      DEPTH: "10",
      ...env,
    },
  });
  const output = Object.fromEntries(
    readFileSync(outputFile, "utf8")
      .split("\n")
      .filter((line) => line.includes("="))
      .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1)]),
  );
  return { status: result.status, stdout: result.stdout + result.stderr, output };
}

beforeEach(() => {
  const root = mkdtempSync(join(tmpdir(), "deploy-tested-tree-"));
  box = { root, work: join(root, "work"), fake: join(root, "fake"), bin: join(root, "bin") };
  mkdirSync(box.bin);
  mkdirSync(box.fake);
  writeFileSync(join(box.bin, "gh"), FAKE_GH, { mode: 0o755 });
  spawnSync("git", ["init", "--quiet", "--bare", join(root, "origin.git")]);
  spawnSync("git", ["init", "--quiet", "-b", "master", box.work]);
  git("remote", "add", "origin", join(root, "origin.git"));
  commitFile("src/a.ts", "a\n");
});

afterEach(() => {
  rmSync(box.root, { recursive: true, force: true });
});

/** A pull request #7 with two commits, merged into master with a merge commit, and the tag on the merge. */
function mergePullRequest(options: { masterChange?: string } = {}): { first: string; second: string; merge: string } {
  git("checkout", "--quiet", "-b", "feature");
  const first = commitFile("src/b.ts", "b\n");
  const second = commitFile("src/b.ts", "b2\n");
  git("checkout", "--quiet", "master");
  if (options.masterChange !== undefined) commitFile(options.masterChange, "master\n");
  git("merge", "--quiet", "--no-ff", "-m", "Merge #7", "feature");
  const merge = git("rev-parse", "HEAD");
  git("push", "--quiet", "origin", "master", "feature");
  git("tag", "v1");
  fake(`pulls/${merge}`, "7\n");
  fake("commits/7", `${first}\n${second}\n`);
  return { first, second, merge };
}

describe("deploy-tested-tree.yml", () => {
  it("is a reusable workflow that reads the repository, its pull requests and checks only", () => {
    expect(Object.keys(workflow.on)).toEqual(["workflow_call"]);
    expect(workflow.permissions).toEqual({ contents: "read" });
    expect(job?.permissions).toEqual({ contents: "read", "pull-requests": "read", checks: "read" });
    expect(workflow.on.workflow_call.inputs).toMatchObject({
      tag: { required: true },
      "check-names": { required: true },
      "ignore-prefixes": { default: "context/" },
      depth: { default: 10 },
    });
    expect(workflow.on.workflow_call.outputs.tested?.value).toBe("${{ jobs.tested.outputs.tested }}");
    expect(job?.outputs).toEqual({ tested: "${{ steps.find.outputs.tested }}", sha: "${{ steps.find.outputs.sha }}" });
  });

  it("answers tested when the tag carries the exact tree of the newest pull request commit that passed", () => {
    const { second } = mergePullRequest();
    fake(`checks/${second}-coverage`, "1\n");
    const result = run();
    expect(result.status).toBe(0);
    expect(result.output).toEqual({ tested: "true", sha: second });
  });

  it("takes an older commit when the newest one did not pass, if only ignored paths differ", () => {
    git("checkout", "--quiet", "-b", "feature");
    const tested = commitFile("src/b.ts", "b\n");
    const archive = commitFile("context/archive/x.md", "done\n");
    git("checkout", "--quiet", "master");
    git("merge", "--quiet", "--no-ff", "-m", "Merge #7", "feature");
    const merge = git("rev-parse", "HEAD");
    git("push", "--quiet", "origin", "master", "feature");
    git("tag", "v1");
    fake(`pulls/${merge}`, "7\n");
    fake("commits/7", `${tested}\n${archive}\n`);
    fake(`checks/${tested}-coverage`, "1\n");
    expect(run().output).toEqual({ tested: "true", sha: tested });
  });

  it("answers not tested when code changed after the commit that passed", () => {
    const { first } = mergePullRequest();
    fake(`checks/${first}-coverage`, "1\n");
    const result = run();
    expect(result.output).toEqual({ tested: "false", sha: "" });
    expect(result.stdout).toContain(`src/b.ts changed after ${first}`);
  });

  it("answers not tested when master brought code the pull request never ran", () => {
    const { second } = mergePullRequest({ masterChange: "src/c.ts" });
    fake(`checks/${second}-coverage`, "1\n");
    expect(run().output).toEqual({ tested: "false", sha: "" });
  });

  it("allows master's own ignored paths, such as a roadmap state commit", () => {
    const { second } = mergePullRequest();
    commitFile("context/foundation/roadmap.md", "state\n");
    git("tag", "-f", "v1");
    fake(`checks/${second}-coverage`, "1\n");
    expect(run().output).toEqual({ tested: "true", sha: second });
  });

  it("needs every named check to have passed on the same commit", () => {
    const { second } = mergePullRequest();
    fake(`checks/${second}-coverage`, "1\n");
    expect(run({ CHECK_NAMES: "coverage e2e" }).output.tested).toBe("false");
    fake(`checks/${second}-e2e`, "2\n");
    expect(run({ CHECK_NAMES: "coverage e2e" }).output).toEqual({ tested: "true", sha: second });
  });

  it("answers not tested when no commit of the pull request passed", () => {
    mergePullRequest();
    const result = run();
    expect(result.output).toEqual({ tested: "false", sha: "" });
    expect(result.stdout).toContain("No commit of #7 passed coverage");
  });

  it("answers not tested when no merged pull request is within depth", () => {
    const { second } = mergePullRequest();
    fake(`checks/${second}-coverage`, "1\n");
    commitFile("context/a.md", "1\n");
    commitFile("context/b.md", "2\n");
    git("tag", "-f", "v1");
    const result = run({ DEPTH: "2" });
    expect(result.output).toEqual({ tested: "false", sha: "" });
    expect(result.stdout).toContain("No merged pull request in the last 2 commits");
  });

  it("answers not tested on an unknown tag and on API failures", () => {
    const { merge, second } = mergePullRequest();
    fake(`checks/${second}-coverage`, "1\n");
    expect(run({ TAG: "v9" }).output).toEqual({ tested: "false", sha: "" });
    fake("fail/pr-7", "");
    expect(run().output).toEqual({ tested: "false", sha: "" });
    fake(`fail/${merge}`, "");
    expect(run().output).toEqual({ tested: "false", sha: "" });
  });

  it("answers not tested when the tested commit cannot be fetched", () => {
    const { second } = mergePullRequest();
    fake(`checks/${second}-coverage`, "1\n");
    git("remote", "set-url", "origin", join(box.root, "missing.git"));
    const unknown = "0".repeat(40);
    fake("commits/7", `${unknown}\n`);
    fake(`checks/${unknown}-coverage`, "1\n");
    const result = run();
    expect(result.output).toEqual({ tested: "false", sha: "" });
    expect(result.stdout).toContain("could not be fetched");
  });

  it.each([["0"], ["51"], ["x"]])("refuses depth %s", (depth) => {
    const result = run({ DEPTH: depth });
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("Input depth is not valid");
  });

  it("refuses empty check names", () => {
    const result = run({ CHECK_NAMES: "  " });
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("Input check-names is not valid");
  });
});
