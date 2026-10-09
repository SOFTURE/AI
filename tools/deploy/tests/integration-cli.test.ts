import { execFileSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { CliIo } from "../src/cli/io.js";
import { runCli } from "../src/cli/run.js";

// A bare repository stands in for GitHub. Its post-receive hook plays deploy-integration.yml: on a push of
// integration/<name> it writes the note prepared in `next-note` (if any) on the pushed commit and deletes the ref.

const POST_RECEIVE = `#!/bin/sh
while read old new ref; do
  case "$ref" in
    refs/heads/integration/*)
      if [ -f "$GIT_DIR/next-note" ]; then
        git -c user.name=ci -c user.email=ci@example.com notes --ref=refs/notes/integration add -f -F "$GIT_DIR/next-note" "$new"
        git update-ref -d "$ref"
      fi
      ;;
  esac
done
`;

let root: string;
let remote: string;
let work: string;
let out: string[];
let err: string[];

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function clone(name: string): string {
  const dir = join(root, name);
  git(root, "clone", "-q", remote, dir);
  git(dir, "config", "user.email", "test@example.com");
  git(dir, "config", "user.name", "Test");
  git(dir, "config", "commit.gpgsign", "false");
  return dir;
}

function commit(dir: string, file: string): string {
  writeFileSync(join(dir, file), file);
  git(dir, "add", file);
  git(dir, "commit", "-q", "-m", `add ${file}`);
  return git(dir, "rev-parse", "HEAD");
}

function makeIo(cwd: string, env: Record<string, string | undefined> = {}): CliIo {
  return { cwd, env, stdout: (text) => out.push(text), stderr: (text) => err.push(text) };
}

function cli(cwd: string, args: string[], env: Record<string, string | undefined> = {}): Promise<number> {
  return runCli(args, makeIo(cwd, env));
}

function note(sha: string, fields: Record<string, unknown> = {}): string {
  return JSON.stringify({
    version: 1,
    result: "green",
    sha,
    name: "feature",
    ref: "refs/heads/integration/feature",
    passed: 3,
    total: 3,
    red: [],
    run: "https://github.com/acme/app/actions/runs/1",
    finishedAt: "2026-10-08T09:00:00Z",
    ...fields,
  });
}

function prepareRemoteNote(text: string): void {
  writeFileSync(join(remote, "next-note"), text);
}

function remoteNote(sha: string): string {
  return git(remote, "notes", "--ref=refs/notes/integration", "show", sha);
}

function remoteRef(ref: string): string {
  return git(remote, "for-each-ref", "--format=%(objectname)", ref);
}

const JUNIT = `<testsuites>
  <testsuite name="e2e">
    <testcase classname="checkout" name="pays by card"/>
    <testcase classname="checkout" name="refunds"><failure message="no"/></testcase>
    <testcase classname="export" name="writes the PDF"/>
  </testsuite>
</testsuites>`;

let mainSha: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "softure-deploy-integration-"));
  remote = join(root, "remote.git");
  git(root, "init", "-q", "--bare", "-b", "trunk", remote);
  writeFileSync(join(remote, "hooks/post-receive"), POST_RECEIVE);
  chmodSync(join(remote, "hooks/post-receive"), 0o755);
  const seed = join(root, "seed");
  mkdirSync(seed);
  git(seed, "init", "-q", "-b", "trunk");
  git(seed, "config", "user.email", "test@example.com");
  git(seed, "config", "user.name", "Test");
  git(seed, "config", "commit.gpgsign", "false");
  mainSha = commit(seed, "a.txt");
  git(seed, "push", "-q", remote, "trunk");
  work = clone("work");
  out = [];
  err = [];
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("softure-deploy integration lookup", () => {
  it("exits 3 when the commit has no stored result", async () => {
    expect(await cli(work, ["integration", "lookup"])).toBe(3);
    expect(err.join("")).toContain(`no stored result for ${mainSha.slice(0, 8)}`);
    expect(out).toEqual([]);
  });

  it("prints a stored green result of INTEGRATION_SHA and exits 0", async () => {
    const ci = clone("ci");
    writeFileSync(join(ci, "junit.xml"), JUNIT.replace('<failure message="no"/>', ""));
    expect(
      await cli(ci, ["integration", "record", `--sha=${mainSha}`, "--ref=refs/heads/trunk", "--result=green", "--junit=junit.xml", "--run=https://github.com/acme/app/actions/runs/9"]),
    ).toBe(0);
    expect(out.join("")).toBe(`integration record: green (3/3) stored on ${mainSha.slice(0, 8)}\n`);
    out = [];
    expect(await cli(work, ["integration", "lookup", "--main=trunk"], { INTEGRATION_SHA: mainSha })).toBe(0);
    expect(out.join("")).toBe("integration: green\ncounts: 3/3\nrun: https://github.com/acme/app/actions/runs/9\n");
  });

  it("exits 1 on a stored red result, with new-red against the main branch named in context/workflow.json", async () => {
    const ci = clone("ci");
    writeFileSync(join(ci, "junit.xml"), JUNIT);
    expect(await cli(ci, ["integration", "record", `--sha=${mainSha}`, "--ref=refs/heads/trunk", "--result=red", "--junit=junit.xml"])).toBe(0);
    const featureSha = commit(work, "b.txt");
    git(work, "push", "-q", "origin", "HEAD:refs/heads/feature");
    git(ci, "fetch", "-q", "origin", "feature");
    const twoRed = JUNIT.replace('name="writes the PDF"/>', 'name="writes the PDF"><error/></testcase>');
    writeFileSync(join(ci, "junit.xml"), twoRed);
    expect(await cli(ci, ["integration", "record", `--sha=${featureSha}`, "--ref=refs/heads/integration/feature", "--result=red", "--junit=junit.xml"])).toBe(0);
    mkdirSync(join(work, "context"));
    writeFileSync(join(work, "context/workflow.json"), JSON.stringify({ mainBranch: "trunk" }));
    out = [];
    expect(await cli(work, ["integration", "lookup"])).toBe(1);
    expect(out.join("")).toBe(
      ["integration: red", "counts: 1/3", "red: checkout › refunds", "red: export › writes the PDF", "new-red: export › writes the PDF", ""].join("\n"),
    );
    expect(err.join("")).toContain("is red");
  });

  it("prints no new-red line when the main branch has no result", async () => {
    const ci = clone("ci");
    writeFileSync(join(ci, "junit.xml"), JUNIT);
    await cli(ci, ["integration", "record", `--sha=${mainSha}`, "--ref=refs/heads/integration/x", "--result=red", "--junit=junit.xml"]);
    out = [];
    // The default main branch is `main`, which this remote does not have.
    expect(await cli(work, ["integration", "lookup"])).toBe(1);
    expect(out.join("")).not.toContain("new-red:");
  });

  it("reads the local notes when the remote cannot be reached", async () => {
    const ci = clone("ci");
    await cli(ci, ["integration", "record", `--sha=${mainSha}`, "--ref=refs/heads/trunk", "--result=green"]);
    expect(await cli(work, ["integration", "lookup"])).toBe(0);
    git(work, "remote", "set-url", "origin", join(root, "gone.git"));
    out = [];
    expect(await cli(work, ["integration", "lookup"])).toBe(0);
    expect(out.join("")).toBe("integration: green\n");
  });
});

describe("softure-deploy integration record", () => {
  it("keeps the note another run pushed meanwhile", async () => {
    const first = clone("first");
    const second = clone("second");
    const otherSha = commit(work, "c.txt");
    git(work, "push", "-q", "origin", "HEAD:refs/heads/other");
    git(second, "fetch", "-q", "origin", "other");
    expect(await cli(first, ["integration", "record", `--sha=${mainSha}`, "--ref=refs/heads/trunk", "--result=green"])).toBe(0);
    expect(await cli(second, ["integration", "record", `--sha=${otherSha}`, "--ref=refs/heads/integration/other", "--result=red"])).toBe(0);
    expect(JSON.parse(remoteNote(mainSha))).toMatchObject({ result: "green", name: "trunk", passed: null, total: null, run: null });
    expect(JSON.parse(remoteNote(otherSha))).toMatchObject({ result: "red", name: "other", ref: "refs/heads/integration/other" });
  });

  it("stores no counts when the report is missing, and says so", async () => {
    expect(await cli(work, ["integration", "record", "--sha=HEAD", "--ref=refs/heads/trunk", "--result=red", "--junit=missing.xml"])).toBe(0);
    expect(err.join("")).toContain("missing.xml does not exist");
    expect(JSON.parse(remoteNote(mainSha))).toMatchObject({ result: "red", passed: null, red: [] });
  });

  it("reads a Playwright JSON report given with --results, by its extension or --format", async () => {
    const report = {
      suites: [
        {
          title: "checkout.spec.ts",
          specs: [
            { title: "pays by card", tests: [{ projectName: "chromium", status: "expected" }] },
            { title: "refunds", tests: [{ projectName: "chromium", status: "flaky" }] },
          ],
        },
      ],
    };
    writeFileSync(join(work, "results.json"), JSON.stringify(report));
    expect(await cli(work, ["integration", "record", "--sha=HEAD", "--ref=refs/heads/trunk", "--result=green", "--results=results.json"])).toBe(0);
    expect(JSON.parse(remoteNote(mainSha))).toMatchObject({ result: "green", passed: 2, total: 2, red: [], flaky: ["[chromium] › checkout.spec.ts › refunds"] });
    writeFileSync(join(work, "results.txt"), JSON.stringify(report));
    expect(
      await cli(work, ["integration", "record", "--sha=HEAD", "--ref=refs/heads/trunk", "--result=green", "--results=results.txt", "--format=playwright-json"]),
    ).toBe(0);
    expect(JSON.parse(remoteNote(mainSha))).toMatchObject({ passed: 2, total: 2 });
    out = [];
    expect(await cli(work, ["integration", "lookup", "--main=trunk"])).toBe(0);
    expect(out.join("")).toBe("integration: green\ncounts: 2/2\nflaky: [chromium] › checkout.spec.ts › refunds\n");
  });

  it("reads --results as JUnit by default, and stores no counts for a report it cannot read", async () => {
    writeFileSync(join(work, "junit.xml"), JUNIT);
    expect(await cli(work, ["integration", "record", "--sha=HEAD", "--ref=refs/heads/trunk", "--result=red", "--results=junit.xml"])).toBe(0);
    expect(JSON.parse(remoteNote(mainSha))).toMatchObject({ passed: 2, total: 3, red: ["checkout › refunds"] });
    writeFileSync(join(work, "broken.json"), "{");
    expect(await cli(work, ["integration", "record", "--sha=HEAD", "--ref=refs/heads/trunk", "--result=red", "--results=broken.json"])).toBe(0);
    expect(err.join("")).toContain("broken.json is not a Playwright JSON report (the report is not JSON); the note has no counts");
    expect(JSON.parse(remoteNote(mainSha))).toMatchObject({ result: "red", passed: null, total: null });
  });

  it("stores red and exits 1 with --fail-on-flaky when a test passed only on a retry", async () => {
    const flaky = { suites: [{ title: "a.spec.ts", specs: [{ title: "retries", tests: [{ status: "flaky" }] }] }] };
    writeFileSync(join(work, "results.json"), JSON.stringify(flaky));
    const args = ["integration", "record", "--sha=HEAD", "--ref=refs/heads/trunk", "--result=green", "--results=results.json", "--fail-on-flaky"];
    expect(await cli(work, args)).toBe(1);
    expect(err.join("")).toContain("1 flaky test and --fail-on-flaky: stored as red");
    expect(JSON.parse(remoteNote(mainSha))).toMatchObject({ result: "red", flaky: ["a.spec.ts › retries"] });
    writeFileSync(join(work, "results.json"), JSON.stringify({ suites: [] }));
    expect(await cli(work, args)).toBe(0);
    expect(JSON.parse(remoteNote(mainSha))).toMatchObject({ result: "green" });
  });

  it("stores the note under --notes-ref and names the run after --ref-prefix", async () => {
    expect(
      await cli(work, [
        "integration",
        "record",
        "--sha=HEAD",
        "--ref=refs/heads/e2e-run/feature",
        "--result=green",
        "--notes-ref=refs/notes/e2e-run",
        "--ref-prefix=e2e-run/",
      ]),
    ).toBe(0);
    expect(JSON.parse(git(remote, "notes", "--ref=refs/notes/e2e-run", "show", mainSha))).toMatchObject({ name: "feature" });
    expect(git(remote, "for-each-ref", "refs/notes/integration")).toBe("");
    expect(await cli(work, ["integration", "lookup"])).toBe(3);
    out = [];
    expect(await cli(work, ["integration", "lookup", "--notes-ref=refs/notes/e2e-run"])).toBe(0);
    expect(out.join("")).toBe("integration: green\n");
  });

  it.each([
    [["--ref=refs/heads/trunk", "--result=green"], "--sha is required"],
    [["--sha=HEAD", "--result=green"], "--ref must name"],
    [["--sha=HEAD", "--ref=refs/heads/trunk", "--result=yellow"], "--result must be green or red"],
    [["--sha=HEAD", "--ref=refs/heads/trunk", "--result=green", "--run=http://x"], "--run must be an https:// URL"],
    [["--sha=HEAD", "--ref=refs/heads/trunk", "--result=green", "--remote=--upload-pack=x"], "--remote must be a remote name"],
    [["--sha=HEAD", "--ref=refs/heads/trunk", "--result=green", "--junit=a.xml", "--results=b.xml"], "--junit and --results"],
    [["--sha=HEAD", "--ref=refs/heads/trunk", "--result=green", "--results=a.xml", "--format=tap"], "--format must be junit or playwright-json"],
    [["--sha=HEAD", "--ref=refs/heads/trunk", "--result=green", "--format=junit"], "--format needs --results"],
    [["--sha=HEAD", "--ref=refs/heads/trunk", "--result=green", "--notes-ref=refs/heads/x"], "--notes-ref must be a ref under refs/notes/"],
    [["--sha=HEAD", "--ref=refs/heads/trunk", "--result=green", "--ref-prefix=integration"], "--ref-prefix must"],
  ])("refuses %j as a usage error", async (args, message) => {
    expect(await cli(work, ["integration", "record", ...args])).toBe(2);
    expect(err.join("")).toContain(message);
  });
});

describe("softure-deploy integration run", () => {
  it("pushes integration/<name>, waits for the note and prints the result", async () => {
    const sha = commit(work, "b.txt");
    prepareRemoteNote(note(sha, { run: "https://github.com/acme/app/actions/runs/2" }));
    expect(await cli(work, ["integration", "run", "--poll-seconds=1"], { INTEGRATION_NAME: "feature", INTEGRATION_WAIT_MINUTES: "1" })).toBe(0);
    expect(out.join("")).toBe("integration: green\ncounts: 3/3\nrun: https://github.com/acme/app/actions/runs/2\n");
    expect(err.join("")).toContain(`pushed ${sha.slice(0, 8)} to refs/heads/integration/feature`);
    expect(remoteRef("refs/heads/integration/feature")).toBe("");
  });

  it("waits for a new note, not the result already stored on the commit", async () => {
    const sha = commit(work, "b.txt");
    git(work, "push", "-q", "origin", "HEAD:refs/heads/feature");
    await cli(work, ["integration", "record", `--sha=${sha}`, "--ref=refs/heads/integration/feature", "--result=red"]);
    prepareRemoteNote(note(sha));
    out = [];
    expect(await cli(work, ["integration", "run", "--name=feature", "--wait-minutes=1", "--poll-seconds=1"])).toBe(0);
    expect(out.join("")).toContain("integration: green\n");
  });

  it("exits 1 with the red lines when the run is red", async () => {
    const sha = commit(work, "b.txt");
    prepareRemoteNote(note(sha, { result: "red", passed: 2, red: ["checkout › refunds"] }));
    expect(await cli(work, ["integration", "run", "--name=feature", "--main=trunk"])).toBe(1);
    expect(out.join("")).toBe(
      "integration: red\ncounts: 2/3\nrun: https://github.com/acme/app/actions/runs/1\nred: checkout › refunds\n",
    );
  });

  it("exits 75 when no result arrives in time, and leaves the ref for the run in progress", async () => {
    const sha = commit(work, "b.txt");
    expect(await cli(work, ["integration", "run", "--name=feature", "--wait-minutes=0"])).toBe(75);
    expect(err.join("")).toContain(`no result for ${sha.slice(0, 8)} within 0 minutes`);
    expect(remoteRef("refs/heads/integration/feature")).toBe(sha);
    err = [];
    // The same commit again: the run already started, so it waits without a second push.
    expect(await cli(work, ["integration", "run", "--name=feature", "--wait-minutes=0"])).toBe(75);
    expect(err.join("")).toContain(`already points at ${sha.slice(0, 8)}`);
  });

  it("refuses a name another commit's run holds, without touching its ref", async () => {
    git(work, "push", "-q", "origin", `${mainSha}:refs/heads/integration/feature`);
    commit(work, "b.txt");
    expect(await cli(work, ["integration", "run", "--name=feature", "--wait-minutes=0"])).toBe(1);
    expect(err.join("")).toContain(`refs/heads/integration/feature is in use by ${mainSha.slice(0, 8)}`);
    expect(remoteRef("refs/heads/integration/feature")).toBe(mainSha);
  });

  it("pushes under --ref-prefix and waits for the note under --notes-ref", async () => {
    const hook = POST_RECEIVE.replaceAll("refs/heads/integration/*", "refs/heads/e2e-run/*").replace("--ref=refs/notes/integration", "--ref=refs/notes/e2e-run");
    writeFileSync(join(remote, "hooks/post-receive"), hook);
    const sha = commit(work, "b.txt");
    prepareRemoteNote(note(sha, { ref: "refs/heads/e2e-run/feature" }));
    const args = ["integration", "run", "--name=feature", "--wait-minutes=1", "--poll-seconds=1", "--ref-prefix=e2e-run/", "--notes-ref=refs/notes/e2e-run"];
    expect(await cli(work, args)).toBe(0);
    expect(err.join("")).toContain(`pushed ${sha.slice(0, 8)} to refs/heads/e2e-run/feature`);
    expect(out.join("")).toContain("integration: green\n");
  });

  it("exits 1 when the remote cannot be reached", async () => {
    commit(work, "b.txt");
    git(work, "remote", "set-url", "origin", join(root, "gone.git"));
    expect(await cli(work, ["integration", "run", "--name=feature", "--wait-minutes=0"])).toBe(1);
    expect(err.join("")).toContain("cannot reach origin; the run did not start");
  });

  it("exits 1 when the remote refuses the push", async () => {
    commit(work, "b.txt");
    writeFileSync(join(remote, "hooks/pre-receive"), "#!/bin/sh\nexit 1\n");
    chmodSync(join(remote, "hooks/pre-receive"), 0o755);
    expect(await cli(work, ["integration", "run", "--name=feature", "--wait-minutes=0"])).toBe(1);
    expect(err.join("")).toContain("origin refused refs/heads/integration/feature; the run did not start");
  });

  it.each([
    [[], "--name (or INTEGRATION_NAME) is required"],
    [["--name=bad name"], "--name may hold"],
    [["--name=a..b"], "--name may hold"],
    [["--name=x", "--wait-minutes=soon"], "--wait-minutes must be a whole number"],
    [["--name=x", "--sha=nope"], "nope names no commit"],
    [["--name=x", "--bogus"], "Unknown option"],
  ])("refuses %j", async (args, message) => {
    const code = await cli(work, ["integration", "run", ...args]);
    expect(code).toBeGreaterThan(0);
    expect(err.join("")).toContain(message);
  });
});
