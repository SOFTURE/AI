import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { CliIo } from "../src/cli/io.js";
import { runCli } from "../src/cli/run.js";
import { ENV_FILE_HEADER } from "../src/env/env-file.js";

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
  it("writes .env.prod with mode 0600 and prints the names, never a value", async () => {
    writeCompose();
    const code = await runCli(["env", "render"], makeIo({ DATABASE_URL: "postgres://db/app", AUTH_SECRET: SECRET }));
    expect(code).toBe(0);
    const envPath = join(dir, ".env.prod");
    expect(readFileSync(envPath, "utf8")).toBe(`${ENV_FILE_HEADER}\nAUTH_SECRET=${SECRET}\nDATABASE_URL=postgres://db/app\n`);
    expect(statSync(envPath).mode & 0o777).toBe(0o600);
    expect(out.join("")).toBe("env render: wrote 2 names from docker/prod/docker-compose.yml to .env.prod: AUTH_SECRET, DATABASE_URL\n");
    expect(err).toEqual([]);
  });

  it("writes the optional names the environment sets and counts them", async () => {
    writeCompose(`${COMPOSE}      MCP_ALLOW_WRITES: \${MCP_ALLOW_WRITES:-}\n      ADMIN_EMAILS: \${ADMIN_EMAILS:-}\n`);
    const code = await runCli(["env", "render"], makeIo({ DATABASE_URL: "x", AUTH_SECRET: SECRET, MCP_ALLOW_WRITES: "1" }));
    expect(code).toBe(0);
    expect(readFileSync(join(dir, ".env.prod"), "utf8")).toBe(
      `${ENV_FILE_HEADER}\nAUTH_SECRET=${SECRET}\nDATABASE_URL=x\nMCP_ALLOW_WRITES=1\n`,
    );
    expect(out.join("")).toBe(
      "env render: wrote 3 names (1 of 2 optional set) from docker/prod/docker-compose.yml to .env.prod: AUTH_SECRET, DATABASE_URL, MCP_ALLOW_WRITES\n",
    );
  });

  it("refuses a missing name, writes nothing and keeps the value of the others out of the output", async () => {
    writeCompose();
    const code = await runCli(["env", "render"], makeIo({ AUTH_SECRET: SECRET }));
    expect(code).toBe(1);
    expect(existsSync(join(dir, ".env.prod"))).toBe(false);
    expect(err.join("")).toBe("env render: .env.prod not written; missing in the environment: DATABASE_URL.\n");
    expect(out.join("") + err.join("")).not.toContain(SECRET);
  });

  it("refuses a value it cannot write literally, naming only the variable", async () => {
    writeCompose();
    const code = await runCli(["env", "render"], makeIo({ DATABASE_URL: "x", AUTH_SECRET: `${SECRET}\nsecond line` }));
    expect(code).toBe(1);
    expect(err.join("")).toContain("no literal one-line form (a newline or a single quote): AUTH_SECRET");
    expect(out.join("") + err.join("")).not.toContain(SECRET);
  });

  it("replaces an existing .env.prod and narrows its mode to 0600", async () => {
    writeCompose();
    writeFileSync(join(dir, ".env.prod"), "OLD=1\n", { mode: 0o644 });
    expect(await runCli(["env", "render"], makeIo({ DATABASE_URL: "d", AUTH_SECRET: "a" }))).toBe(0);
    expect(readFileSync(join(dir, ".env.prod"), "utf8")).toBe(`${ENV_FILE_HEADER}\nAUTH_SECRET=a\nDATABASE_URL=d\n`);
    expect(statSync(join(dir, ".env.prod")).mode & 0o777).toBe(0o600);
  });

  it("takes another compose file and output path", async () => {
    writeFileSync(join(dir, "compose.yml"), "x: ${ONLY:?}\n");
    const code = await runCli(["env", "render", "--compose=compose.yml", "--out", "secrets.env"], makeIo({ ONLY: "1" }));
    expect(code).toBe(0);
    expect(readFileSync(join(dir, "secrets.env"), "utf8")).toBe(`${ENV_FILE_HEADER}\nONLY=1\n`);
  });

  it("fails on a missing compose file, a compose file without required names and an unknown flag", async () => {
    expect(await runCli(["env", "render"], makeIo())).toBe(1);
    expect(err.at(-1)).toMatch(/cannot read the compose file .*docker-compose\.yml \(ENOENT\)/);
    writeCompose("services: {}\n");
    expect(await runCli(["env", "render"], makeIo())).toBe(1);
    expect(err.at(-1)).toContain("has no required");
    expect(await runCli(["env", "render", "--composee=x"], makeIo())).toBe(2);
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

  it("prints the report since the previous tag, linking to the Actions repository", async () => {
    const code = await runCli(
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

  it("adds the roadmap's done_code items and keeps the owner's text of the release body", async () => {
    writeFileSync(
      join(dir, "roadmap.md"),
      "## At a glance\n\n| ID | Change | Outcome | Status |\n| --- | --- | --- | --- |\n| **AB-1** | `export` | CSV export | done_code |\n| **AB-2** | `old` | shipped | done |\n",
    );
    writeFileSync(join(dir, "body.md"), "What this version is about.\n");
    const args = ["release-notes", "--to=v1.1.0", "--roadmap=roadmap.md", "--body=body.md", "--out=body.md"];
    expect(await runCli(args, makeIo())).toBe(0);
    expect(await runCli(args, makeIo())).toBe(0);
    const body = readFileSync(join(dir, "body.md"), "utf8");
    expect(body.startsWith("What this version is about.\n\n<!-- softure-deploy:release-notes -->\n## v1.1.0")).toBe(true);
    expect(body.split("<!-- softure-deploy:release-notes -->")).toHaveLength(2);
    expect(body).toContain("| **AB-1** | `export` | CSV export |");
    expect(body).not.toContain("AB-2");
  });

  it("starts a release body that does not exist yet and fails on a missing roadmap", async () => {
    expect(await runCli(["release-notes", "--to=v1.1.0", "--body=new.md"], makeIo())).toBe(0);
    expect(out.join("")).toMatch(/^<!-- softure-deploy:release-notes -->\n## v1\.1\.0/);
    expect(await runCli(["release-notes", "--to=v1.1.0", "--roadmap=missing.md"], makeIo())).toBe(1);
    expect(err.at(-1)).toBe("release-notes: cannot read missing.md (ENOENT).\n");
  });

  it("writes the report to a file in Polish", async () => {
    const code = await runCli(["release-notes", "--from=v1.0.0", "--to=v1.1.0", "--locale=pl", "--out=notes.md"], makeIo());
    expect(code).toBe(0);
    expect(readFileSync(join(dir, "notes.md"), "utf8")).toContain("### Pull requesty");
    expect(out.join("")).toBe("release-notes: v1.0.0...v1.1.0 written to notes.md\n");
  });

  it("rejects an option-like ref, an unknown ref, an unknown locale and a bad repository URL", async () => {
    expect(await runCli(["release-notes", "--from=--output=x"], makeIo())).toBe(2);
    expect(await runCli(["release-notes", "--to=v9.9.9"], makeIo())).toBe(1);
    expect(err.at(-1)).toContain("names no commit");
    expect(await runCli(["release-notes", "--locale=de"], makeIo())).toBe(2);
    expect(await runCli(["release-notes", "--repo-url=http://example.com/a/b"], makeIo())).toBe(2);
  });
});

describe("softure-deploy", () => {
  it("prints the usage for help and exits 2 on no or an unknown command", async () => {
    expect(await runCli(["help"], makeIo())).toBe(0);
    expect(out.join("")).toContain("Usage: softure-deploy");
    for (const command of ["backup", "schema-guard", "row-counts", "verify"]) expect(out.join("")).toContain(`\n  ${command} `);
    expect(await runCli([], makeIo())).toBe(2);
    expect(await runCli(["deploy"], makeIo())).toBe(2);
    expect(err.join("")).toContain('unknown command "deploy"');
  });

  it("has a node shebang on the bin entry", () => {
    expect(readFileSync(join(import.meta.dirname, "../src/cli/main.ts"), "utf8").startsWith("#!/usr/bin/env node\n")).toBe(true);
  });
});
