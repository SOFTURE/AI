import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { CliIo } from "../src/cli/io.js";
import { runCli } from "../src/cli/run.js";

// Issue #247: `run` and `report` reach the server through ssh. The stub ssh keeps its arguments (one per line) and
// its stdin, prints a line on each stream and exits with SSH_STATUS.
const STUB_SSH = `#!/usr/bin/env bash
printf '%s\\n' "$@" > "$SSH_ARGS"
cat > "$SSH_STDIN"
echo "remote: out"
echo "remote: err" >&2
exit "\${SSH_STATUS:-0}"
`;

let dir: string;
let out: string[];
let err: string[];
let ssh: string;

function makeIo(options: { stdin?: string; status?: number } = {}): CliIo {
  return {
    cwd: dir,
    env: {
      PATH: process.env.PATH,
      SSH_ARGS: join(dir, "ssh-args"),
      SSH_STDIN: join(dir, "ssh-stdin"),
      SSH_STATUS: String(options.status ?? 0),
    },
    stdout: (text) => out.push(text),
    stderr: (text) => err.push(text),
    stdin: Readable.from([options.stdin ?? ""]),
  };
}

function sshArgs(): string[] {
  return readFileSync(join(dir, "ssh-args"), "utf8").trimEnd().split("\n");
}

function sshStdin(): string {
  return readFileSync(join(dir, "ssh-stdin"), "utf8");
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "softure-deploy-remote-"));
  out = [];
  err = [];
  ssh = join(dir, "ssh");
  writeFileSync(ssh, STUB_SSH);
  chmodSync(ssh, 0o755);
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("softure-deploy run", () => {
  it("sends the script and its arguments as one command line to the host's forced command, with stdin", async () => {
    const status = await runCli(
      ["run", "--host=fire-prod", `--ssh=${ssh}`, "grant-access", "--email=a@example.com", "--commit"],
      makeIo({ stdin: "from the operator\n" }),
    );
    expect(status).toBe(0);
    expect(sshArgs()).toEqual(["-T", "--", "fire-prod", "run grant-access --email=a@example.com --commit"]);
    expect(sshStdin()).toBe("from the operator\n");
    expect(out.join("")).toBe("remote: out\n");
    expect(err.join("")).toBe("remote: err\n");
  });

  it("passes the port to ssh", async () => {
    await runCli(["run", "--host=fire-prod", "--port=2222", `--ssh=${ssh}`, "grant-access"], makeIo());
    expect(sshArgs()).toEqual(["-T", "-p", "2222", "--", "fire-prod", "run grant-access"]);
  });

  it("gives every word after the script to the script, also one that looks like a client flag", async () => {
    await runCli(["run", "--host=fire-prod", `--ssh=${ssh}`, "grant-access", "--host=other", "--help"], makeIo());
    expect(sshArgs().at(-1)).toBe("run grant-access --host=other --help");
  });

  it("reads a --<key>-file on this machine and sends it on stdin, so the secret never reaches a command line", async () => {
    writeFileSync(join(dir, "password.txt"), "s3cret value\n");
    const status = await runCli(
      ["run", "--host=fire-prod", `--ssh=${ssh}`, "set-password", "--email=a@example.com", "--password-file=password.txt"],
      makeIo({ stdin: "ignored" }),
    );
    expect(status).toBe(0);
    expect(sshArgs().at(-1)).toBe("run set-password --email=a@example.com --password-file=-");
    expect(sshStdin()).toBe("s3cret value\n");
  });

  it("keeps --<key>-file=- and forwards stdin", async () => {
    await runCli(["run", "--host=fire-prod", `--ssh=${ssh}`, "set-password", "--password-file=-"], makeIo({ stdin: "pw\n" }));
    expect(sshArgs().at(-1)).toBe("run set-password --password-file=-");
    expect(sshStdin()).toBe("pw\n");
  });

  it("ends with the remote status", async () => {
    expect(await runCli(["run", "--host=fire-prod", `--ssh=${ssh}`, "grant-access"], makeIo({ status: 2 }))).toBe(2);
  });

  it("names the host when ssh itself fails", async () => {
    const status = await runCli(["run", "--host=fire-prod", `--ssh=${ssh}`, "grant-access"], makeIo({ status: 255 }));
    expect(status).toBe(1);
    expect(err.join("")).toBe("remote: err\nsofture-deploy: ssh to fire-prod failed (exit 255); nothing ran on the server.\n");
  });

  it("fails with one line when ssh cannot start", async () => {
    const status = await runCli(["run", "--host=fire-prod", `--ssh=${join(dir, "missing")}`, "grant-access"], makeIo());
    expect(status).toBe(1);
    expect(err.join("")).toMatch(/^cannot start .*missing: /);
  });

  it.each([
    [["run", "grant-access"], "run: --host=<ssh host> is required"],
    [["run", "--host=-oProxyCommand=x", "grant-access"], 'run: --host is not an ssh host or alias: "-oProxyCommand=x"'],
    [["run", "--host=fire-prod", "--port=22x", "grant-access"], 'run: --port is not a port: "22x"'],
    [["run", "--host=fire-prod", "--host=other", "grant-access"], "run: --host is given twice"],
    [["run", "--host=fire-prod", "--commit", "grant-access"], 'run: unknown option "--commit" before the script'],
    [["run", "--host=fire-prod"], "run: the ops script name is missing"],
    [["run", "--host=fire-prod", "../grant-access"], 'run: the ops script name is not kebab-case: "../grant-access"'],
    [["run", "--host=fire-prod", "grant-access", "email=a"], 'run: arguments look like --key or --key=value: "email=a"'],
    [
      ["run", "--host=fire-prod", "grant-access", "--note=two words"],
      "run: the value of --note holds a blank, which the server cannot pass on; put it in a file and use --note-file",
    ],
    [
      ["run", "--host=fire-prod", "grant-access", "--a-file=x", "--b-file=y"],
      "run: only one --<key>-file can travel on stdin; got --a-file=x, --b-file=y",
    ],
  ])("refuses %j with exit 2 before connecting", async (argv, message) => {
    const status = await runCli([...argv.slice(0, 1), `--ssh=${ssh}`, ...argv.slice(1)], makeIo());
    expect(status).toBe(2);
    expect(err.join("")).toBe(`${message}\n`);
    expect(() => readFileSync(join(dir, "ssh-args"))).toThrow();
  });

  it("refuses an unreadable --<key>-file with exit 1 before connecting", async () => {
    const status = await runCli(["run", "--host=fire-prod", `--ssh=${ssh}`, "set-password", "--password-file=nope.txt"], makeIo());
    expect(status).toBe(1);
    expect(err.join("")).toBe("run: cannot read nope.txt\n");
  });
});

describe("softure-deploy report", () => {
  it("sends the SQL file on stdin and the arguments on the command line", async () => {
    const sql = "select count(*) from users where created_at >= :'since';\n";
    writeFileSync(join(dir, "signups.sql"), sql);
    const status = await runCli(["report", "--host=fire-prod", `--ssh=${ssh}`, "signups.sql", "--since=2026-01-01"], makeIo());
    expect(status).toBe(0);
    expect(sshArgs()).toEqual(["-T", "--", "fire-prod", "report --since=2026-01-01"]);
    expect(sshStdin()).toBe(sql);
    expect(out.join("")).toBe("remote: out\n");
  });

  it("ends with the remote status", async () => {
    writeFileSync(join(dir, "r.sql"), "select 1;\n");
    expect(await runCli(["report", "--host=fire-prod", `--ssh=${ssh}`, "r.sql"], makeIo({ status: 3 }))).toBe(3);
  });

  it.each([
    [["report", "--host=fire-prod", "r.sql", "--commit"], "report: a report is read only; --commit has no meaning here", 2],
    [["report", "--host=fire-prod", "r.sql", "--verbose"], 'report: arguments look like --key=value: "--verbose"', 2],
    [["report", "--host=fire-prod"], "report: the SQL file is missing", 2],
    [["report", "--host=fire-prod", "missing.sql"], "report: cannot read missing.sql", 1],
    [["report", "--host=fire-prod", "empty.sql"], "report: empty.sql is empty", 1],
  ])("refuses %j before connecting", async (argv, message, code) => {
    writeFileSync(join(dir, "r.sql"), "select 1;\n");
    writeFileSync(join(dir, "empty.sql"), "");
    const status = await runCli([...argv.slice(0, 1), `--ssh=${ssh}`, ...argv.slice(1)], makeIo());
    expect(status).toBe(code);
    expect(err.join("")).toBe(`${message}\n`);
    expect(() => readFileSync(join(dir, "ssh-args"))).toThrow();
  });
});
