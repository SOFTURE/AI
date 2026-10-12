import { chmodSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { describeDatabaseUrl } from "../src/cli/local-command.js";
import type { CliIo } from "../src/cli/io.js";
import { runCli } from "../src/cli/run.js";

// Issue #405: `run --local` runs scripts/ops/<name>.ts with tsx against DATABASE_URL. The stub tsx keeps its
// arguments (NUL-separated), working folder, DATABASE_URL and stdin, prints a line on each stream and exits with
// TSX_STATUS.
const STUB_TSX = `#!/usr/bin/env bash
: > "$RECORD/args"
for arg in "$@"; do printf '%s\\0' "$arg" >> "$RECORD/args"; done
pwd > "$RECORD/cwd"
printf '%s' "$DATABASE_URL" > "$RECORD/url"
cat > "$RECORD/stdin"
echo "script: out"
echo "script: err" >&2
exit "\${TSX_STATUS:-0}"
`;

let dir: string;
let app: string;
let record: string;
let bin: string;
let out: string[];
let err: string[];

function makeIo(options: { env?: Record<string, string>; stdin?: string; status?: number } = {}): CliIo {
  return {
    cwd: app,
    env: {
      PATH: `${bin}:${process.env.PATH ?? ""}`,
      RECORD: record,
      TSX_STATUS: String(options.status ?? 0),
      DATABASE_URL: "postgres://app:secret@localhost:5432/app_dev",
      ...options.env,
    },
    stdout: (text) => out.push(text),
    stderr: (text) => err.push(text),
    stdin: Readable.from([options.stdin ?? ""]),
  };
}

function recorded(name: string): string {
  return readFileSync(join(record, name), "utf8");
}

function recordedArgs(): string[] {
  return recorded("args").split("\0").slice(0, -1);
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "softure-deploy-local-"));
  app = join(dir, "app");
  record = join(dir, "record");
  bin = join(dir, "bin");
  for (const folder of [join(app, "scripts", "ops"), join(app, "tools"), record, bin]) mkdirSync(folder, { recursive: true });
  for (const file of ["grant-access.ts", "set-password.ts", "grant-access.test.ts"]) {
    writeFileSync(join(app, "scripts", "ops", file), "");
  }
  writeFileSync(join(app, "tools", "fix-plan.ts"), "");
  writeFileSync(join(bin, "tsx"), STUB_TSX);
  chmodSync(join(bin, "tsx"), 0o755);
  out = [];
  err = [];
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("softure-deploy run --local", () => {
  it("runs scripts/ops/<name>.ts with tsx in the app folder, the words after the name as its arguments", async () => {
    const status = await runCli(
      ["run", "--local", "grant-access", "--email=a@example.com", "--commit"],
      makeIo({ stdin: "from the operator\n" }),
    );
    expect(status).toBe(0);
    expect(recordedArgs()).toEqual(["scripts/ops/grant-access.ts", "--email=a@example.com", "--commit"]);
    // realpath: on macOS the temporary folder is behind a symlink (/var -> /private/var), and pwd prints the target.
    expect(recorded("cwd").trim()).toBe(realpathSync(app));
    expect(recorded("url")).toBe("postgres://app:secret@localhost:5432/app_dev");
    expect(recorded("stdin")).toBe("from the operator\n");
    expect(out.join("")).toBe("script: out\n");
    expect(err.join("")).toBe("softure-deploy: ops script grant-access locally against localhost:5432/app_dev\nscript: err\n");
  });

  it("leaves the dry run to the script: without --commit nothing is added", async () => {
    await runCli(["run", "--local", "grant-access", "--email=a@example.com"], makeIo());
    expect(recordedArgs()).toEqual(["scripts/ops/grant-access.ts", "--email=a@example.com"]);
  });

  it("passes a value with a blank, --help, --<key>-file and a word that looks like a client flag as they are", async () => {
    await runCli(
      ["run", "--local", "set-password", "--note=two words", "--password-file=pw.txt", "--host=x", "--help"],
      makeIo(),
    );
    expect(recordedArgs()).toEqual(["scripts/ops/set-password.ts", "--note=two words", "--password-file=pw.txt", "--host=x", "--help"]);
  });

  it("ends with the script's status", async () => {
    expect(await runCli(["run", "--local", "grant-access"], makeIo({ status: 2 }))).toBe(2);
  });

  it("takes the database from --url-env, the scripts from --scripts-dir and the runner from --tsx", async () => {
    writeFileSync(join(bin, "my-tsx"), STUB_TSX);
    chmodSync(join(bin, "my-tsx"), 0o755);
    const status = await runCli(
      ["run", "--local", "--url-env=LOCAL_DB", "--scripts-dir=tools", `--tsx=${join(bin, "my-tsx")}`, "fix-plan"],
      makeIo({ env: { LOCAL_DB: "postgresql://u:p@db.internal/other" } }),
    );
    expect(status).toBe(0);
    expect(recordedArgs()).toEqual(["tools/fix-plan.ts"]);
    expect(recorded("url")).toBe("postgresql://u:p@db.internal/other");
    expect(err.join("")).toMatch(/^softure-deploy: ops script fix-plan locally against db\.internal\/other\n/);
  });

  it("names the variable instead of the database when the value is not a URL", async () => {
    await runCli(["run", "--local", "grant-access"], makeIo({ env: { DATABASE_URL: "host=localhost dbname=app" } }));
    expect(err.join("")).toMatch(/^softure-deploy: ops script grant-access locally against the database in DATABASE_URL\n/);
  });

  it.each([
    [["run", "--local", "--host=app-prod", "grant-access"], "run: --host belongs to a run on the server; --local runs on this machine"],
    [["run", "--port=22", "--local", "grant-access"], "run: --port belongs to a run on the server; --local runs on this machine"],
    [["run", "--local", "--ssh=ssh", "grant-access"], "run: --ssh belongs to a run on the server; --local runs on this machine"],
    [["run", "--local", "--local", "grant-access"], "run: --local is given twice"],
    [["run", "--local", "--commit", "grant-access"], 'run: unknown option "--commit" before the script'],
    [["run", "--local", "--tsx=", "grant-access"], "run: --tsx needs a value"],
    [["run", "--local", "--url-env=A-B", "grant-access"], 'run: --url-env is not a variable name: "A-B"'],
    [["run", "--local"], "run: the ops script name is missing"],
    [["run", "--local", "../grant-access"], 'run: the ops script name is not kebab-case: "../grant-access"'],
    [["run", "--local", "grant-access", "email=a"], 'run: arguments look like --key or --key=value: "email=a"'],
  ])("refuses %j with exit 2 before running anything", async (argv, message) => {
    const status = await runCli(argv, makeIo());
    expect(status).toBe(2);
    expect(err.join("")).toBe(`${message}\n`);
    expect(() => readFileSync(join(record, "args"))).toThrow();
  });

  it("refuses with exit 1 when the database variable is not set", async () => {
    const status = await runCli(["run", "--local", "grant-access"], makeIo({ env: { DATABASE_URL: "" } }));
    expect(status).toBe(1);
    expect(err.join("")).toBe("run --local: DATABASE_URL is not set; nothing ran\n");
    const named = await runCli(["run", "--local", "--url-env=LOCAL_DB", "grant-access"], makeIo());
    expect(named).toBe(1);
    expect(err.join("")).toMatch(/run --local: LOCAL_DB is not set; nothing ran\n$/);
  });

  it("refuses an unknown script with exit 1 and lists the folder's scripts", async () => {
    const status = await runCli(["run", "--local", "grant-acess"], makeIo());
    expect(status).toBe(1);
    expect(err.join("")).toBe('run --local: scripts/ops has no ops script "grant-acess"; it has: grant-access set-password\n');
    await runCli(["run", "--local", "--scripts-dir=missing", "grant-access"], makeIo());
    expect(err.join("")).toMatch(/run --local: missing has no ops script "grant-access"; it has: none\n$/);
  });

  it("fails with one line when the runner cannot start", async () => {
    const status = await runCli(["run", "--local", `--tsx=${join(dir, "missing")}`, "grant-access"], makeIo());
    expect(status).toBe(1);
    expect(err.join("")).toMatch(/\ncannot start .*missing: /);
  });
});

describe("describeDatabaseUrl", () => {
  it.each([
    ["postgres://app:secret@localhost:5432/app_dev", "localhost:5432/app_dev"],
    ["postgresql://db.internal/app", "db.internal/app"],
    ["host=localhost dbname=app", null],
    ["file:///tmp/db", null],
  ])("%s → %s", (url, expected) => {
    expect(describeDatabaseUrl(url)).toBe(expected);
  });
});
