import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { CliIo } from "../src/cli/io.js";
import { runCli } from "../src/cli/run.js";

const SECRET = "sentinel-secret-value-9f3a";
const COMPOSE = [
  "services:",
  "  app:",
  "    environment:",
  "      DATABASE_URL: ${DATABASE_URL:?}",
  "      AUTH_SECRET: ${AUTH_SECRET:?set it}",
  "",
].join("\n");

let dir: string;
let out: string[];
let err: string[];

function makeIo(env: Record<string, string | undefined> = {}): CliIo {
  return { cwd: dir, env, stdout: (text) => out.push(text), stderr: (text) => err.push(text) };
}

function writeCompose(text = COMPOSE): void {
  mkdirSync(join(dir, "docker/prod"), { recursive: true });
  writeFileSync(join(dir, "docker/prod/docker-compose.yml"), text);
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "softure-deploy-cli-"));
  out = [];
  err = [];
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("softure-deploy env render", () => {
  it("writes .env.prod with mode 0600 and prints the names, never a value", () => {
    writeCompose();
    const code = runCli(["env", "render"], makeIo({ DATABASE_URL: "postgres://db/app", AUTH_SECRET: SECRET }));
    expect(code).toBe(0);
    const envPath = join(dir, ".env.prod");
    expect(readFileSync(envPath, "utf8")).toBe(`AUTH_SECRET=${SECRET}\nDATABASE_URL=postgres://db/app\n`);
    expect(statSync(envPath).mode & 0o777).toBe(0o600);
    expect(out.join("")).toBe("env render: wrote 2 names from docker/prod/docker-compose.yml to .env.prod: AUTH_SECRET, DATABASE_URL\n");
    expect(err).toEqual([]);
  });

  it("refuses a missing name, writes nothing and keeps the value of the others out of the output", () => {
    writeCompose();
    const code = runCli(["env", "render"], makeIo({ AUTH_SECRET: SECRET }));
    expect(code).toBe(1);
    expect(existsSync(join(dir, ".env.prod"))).toBe(false);
    expect(err.join("")).toBe("env render: .env.prod not written; missing in the environment: DATABASE_URL.\n");
    expect(out.join("") + err.join("")).not.toContain(SECRET);
  });

  it("refuses a value it cannot write literally, naming only the variable", () => {
    writeCompose();
    const code = runCli(["env", "render"], makeIo({ DATABASE_URL: "x", AUTH_SECRET: `${SECRET}\nsecond line` }));
    expect(code).toBe(1);
    expect(err.join("")).toContain("no literal one-line form (a newline or a single quote): AUTH_SECRET");
    expect(out.join("") + err.join("")).not.toContain(SECRET);
  });

  it("replaces an existing .env.prod and narrows its mode to 0600", () => {
    writeCompose();
    writeFileSync(join(dir, ".env.prod"), "OLD=1\n", { mode: 0o644 });
    expect(runCli(["env", "render"], makeIo({ DATABASE_URL: "d", AUTH_SECRET: "a" }))).toBe(0);
    expect(readFileSync(join(dir, ".env.prod"), "utf8")).toBe("AUTH_SECRET=a\nDATABASE_URL=d\n");
    expect(statSync(join(dir, ".env.prod")).mode & 0o777).toBe(0o600);
  });

  it("takes another compose file and output path", () => {
    writeFileSync(join(dir, "compose.yml"), "x: ${ONLY:?}\n");
    const code = runCli(["env", "render", "--compose=compose.yml", "--out", "secrets.env"], makeIo({ ONLY: "1" }));
    expect(code).toBe(0);
    expect(readFileSync(join(dir, "secrets.env"), "utf8")).toBe("ONLY=1\n");
  });

  it("fails on a missing compose file, a compose file without required names and an unknown flag", () => {
    expect(runCli(["env", "render"], makeIo())).toBe(1);
    expect(err.at(-1)).toMatch(/cannot read the compose file .*docker-compose\.yml \(ENOENT\)/);
    writeCompose("services: {}\n");
    expect(runCli(["env", "render"], makeIo())).toBe(1);
    expect(err.at(-1)).toContain("has no required variable");
    expect(runCli(["env", "render", "--composee=x"], makeIo())).toBe(2);
    expect(err.at(-1)).toContain("--composee");
  });
});

describe("softure-deploy release-notes", () => {
  function git(...args: string[]): void {
    execFileSync("git", args, { cwd: dir, stdio: "ignore" });
  }

  beforeEach(() => {
    git("init", "-q", "-b", "main");
    git("config", "user.email", "test@example.com");
    git("config", "user.name", "Test");
    git("config", "commit.gpgsign", "false");
    git("commit", "-q", "--allow-empty", "-m", "chore: start");
    git("tag", "v1.0.0");
    git("commit", "-q", "--allow-empty", "-m", "feat: export to CSV (#3)");
    git("tag", "v1.1.0");
  });

  it("prints the report since the previous tag, linking to the Actions repository", () => {
    const code = runCli(
      ["release-notes", "--to=v1.1.0", "--match=v*"],
      makeIo({ GITHUB_SERVER_URL: "https://github.com", GITHUB_REPOSITORY: "acme/app" }),
    );
    expect(code).toBe(0);
    const notes = out.join("");
    expect(notes).toMatch(/^## v1\.1\.0 \(\d{4}-\d{2}-\d{2}\)\n/);
    expect(notes).toContain("Changes since v1.0.0: 1 pull requests, 0 other commits.");
    expect(notes).toContain("- feat: export to CSV ([#3](https://github.com/acme/app/pull/3))");
    expect(notes).toContain("[Full diff](https://github.com/acme/app/compare/v1.0.0...v1.1.0)");
  });

  it("writes the report to a file in Polish", () => {
    const code = runCli(["release-notes", "--from=v1.0.0", "--to=v1.1.0", "--locale=pl", "--out=notes.md"], makeIo());
    expect(code).toBe(0);
    expect(readFileSync(join(dir, "notes.md"), "utf8")).toContain("### Pull requesty");
    expect(out.join("")).toBe("release-notes: v1.0.0...v1.1.0 written to notes.md\n");
  });

  it("rejects an option-like ref, an unknown ref, an unknown locale and a bad repository URL", () => {
    expect(runCli(["release-notes", "--from=--output=x"], makeIo())).toBe(2);
    expect(runCli(["release-notes", "--to=v9.9.9"], makeIo())).toBe(1);
    expect(err.at(-1)).toContain("names no commit");
    expect(runCli(["release-notes", "--locale=de"], makeIo())).toBe(2);
    expect(runCli(["release-notes", "--repo-url=http://example.com/a/b"], makeIo())).toBe(2);
  });
});

describe("softure-deploy", () => {
  it("prints the usage for help and exits 2 on no or an unknown command", () => {
    expect(runCli(["help"], makeIo())).toBe(0);
    expect(out.join("")).toContain("Usage: softure-deploy");
    expect(runCli([], makeIo())).toBe(2);
    expect(runCli(["deploy"], makeIo())).toBe(2);
    expect(err.join("")).toContain('unknown command "deploy"');
  });

  it("has a node shebang on the bin entry", () => {
    expect(readFileSync(join(import.meta.dirname, "../src/cli/main.ts"), "utf8").startsWith("#!/usr/bin/env node\n")).toBe(true);
  });
});
