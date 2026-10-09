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

  it("refuses a value shorter than its --min-length by name and length, never the value, and writes nothing", async () => {
    writeCompose(`${COMPOSE}      ADMIN_EMAILS: \${ADMIN_EMAILS:-}\n`);
    const io = makeIo({ DATABASE_URL: "x", AUTH_SECRET: "short-secret" });
    const code = await runCli(["env", "render", "--min-length=AUTH_SECRET=32", "--min-length=ADMIN_EMAILS=5"], io);
    expect(code).toBe(1);
    expect(existsSync(join(dir, ".env.prod"))).toBe(false);
    expect(err.join("")).toBe("env render: .env.prod not written; shorter than the --min-length: AUTH_SECRET (32).\n");
    expect(out.join("") + err.join("")).not.toContain("short-secret");
  });

  it("writes a value as long as its --min-length and reports it with the missing names otherwise", async () => {
    writeCompose();
    expect(await runCli(["env", "render", "--min-length=AUTH_SECRET=26"], makeIo({ DATABASE_URL: "x", AUTH_SECRET: SECRET }))).toBe(0);
    expect(readFileSync(join(dir, ".env.prod"), "utf8")).toContain(`AUTH_SECRET=${SECRET}\n`);
    rmSync(join(dir, ".env.prod"));
    expect(await runCli(["env", "render", "--min-length=AUTH_SECRET=27"], makeIo({ AUTH_SECRET: SECRET }))).toBe(1);
    expect(err.join("")).toBe(
      "env render: .env.prod not written; missing in the environment: DATABASE_URL; shorter than the --min-length: AUTH_SECRET (27).\n",
    );
  });

  it("refuses a --min-length the compose file does not use, or one that is not NAME=<length>, as a usage error", async () => {
    writeCompose();
    const env = { DATABASE_URL: "x", AUTH_SECRET: SECRET };
    expect(await runCli(["env", "render", "--min-length=SESSION_KEY=32"], makeIo(env))).toBe(2);
    expect(await runCli(["env", "render", "--min-length=AUTH_SECRET=0"], makeIo(env))).toBe(2);
    expect(await runCli(["env", "render", "--min-length=AUTH_SECRET"], makeIo(env))).toBe(2);
    expect(err.join("")).toBe(
      [
        "env render: --min-length names SESSION_KEY, which the compose file does not use.",
        "env render: --min-length=AUTH_SECRET=0 is not NAME=<length>, a length from 1 to 9999.",
        "env render: --min-length=AUTH_SECRET is not NAME=<length>, a length from 1 to 9999.",
        "",
      ].join("\n"),
    );
    expect(existsSync(join(dir, ".env.prod"))).toBe(false);
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

describe("softure-deploy release-report", () => {
  const SUMMARY = {
    version: 1,
    tag: "v1.0.0",
    environment: "production",
    image: "ghcr.io/acme/app:v1.0.0",
    digest: "sha256:0123456789abcdef0123456789abcdef",
    runUrl: "https://github.com/acme/app/actions/runs/7/attempts/1",
    finishedAt: "2026-10-06T12:00:00Z",
    jobs: [
      { name: "check", result: "success" },
      { name: "build", result: "success" },
      { name: "deploy", result: "success" },
      { name: "verify", result: "success" },
    ],
    serverLines: ["step|backup|ok|db-1.dump", "result|ok"],
  };

  it("writes the status and a deployment row into --out, keeping the body's text", async () => {
    writeFileSync(join(dir, "summary.json"), JSON.stringify(SUMMARY));
    writeFileSync(join(dir, "body.md"), "Owner's words.\n");
    const code = await runCli(["release-report", "--body=body.md", "--summary=summary.json", "--out=body.md"], makeIo());
    expect(code).toBe(0);
    const body = readFileSync(join(dir, "body.md"), "utf8");
    expect(body.startsWith("Owner's words.\n\n<!-- softure-deploy:status -->\n## Pipeline status")).toBe(true);
    expect(body).toContain("| ✅ deployed | production | `ghcr.io/acme/app:v1.0.0`");
    expect(out.join("")).toBe("release-report: report of v1.0.0 written to body.md\n");
    expect(err).toEqual([]);
  });

  it("prints the body without --out and treats a missing body file as empty", async () => {
    writeFileSync(join(dir, "summary.json"), JSON.stringify({ ...SUMMARY, jobs: [{ name: "deploy", result: "skipped" }] }));
    const code = await runCli(["release-report", "--body=none.md", "--summary=summary.json", "--locale=pl"], makeIo());
    expect(code).toBe(0);
    expect(out.join("")).toContain("## Status pipeline'u");
    expect(out.join("")).not.toContain("softure-deploy:deployments");
  });

  it("fails with the field's name on a summary of another shape, and on a missing summary", async () => {
    writeFileSync(join(dir, "summary.json"), JSON.stringify({ ...SUMMARY, version: 2 }));
    expect(await runCli(["release-report", "--body=b.md", "--summary=summary.json"], makeIo())).toBe(1);
    expect(err.join("")).toContain("release-report: summary.json is not a deploy report: version");
    err = [];
    expect(await runCli(["release-report", "--body=b.md", "--summary=gone.json"], makeIo())).toBe(1);
    expect(err.join("")).toContain("release-report: cannot read gone.json (ENOENT)");
  });

  it("requires --body and --summary and a known locale", async () => {
    expect(await runCli(["release-report", "--summary=s.json"], makeIo())).toBe(2);
    expect(await runCli(["release-report", "--body=b.md"], makeIo())).toBe(2);
    expect(await runCli(["release-report", "--body=b.md", "--summary=s.json", "--locale=de"], makeIo())).toBe(2);
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

describe("softure-deploy env render --from-json-env", () => {
  const SECRETS = JSON.stringify({ DATABASE_URL: "postgres://db/app", AUTH_SECRET: SECRET, PORT: 3000 });

  it("takes the values from the JSON objects only, the later one winning, and prints names, never a value", async () => {
    writeCompose(`${COMPOSE}      MCP_ALLOW_WRITES: \${MCP_ALLOW_WRITES:-}\n`);
    const vars = JSON.stringify({ DATABASE_URL: "postgres://db/override", MCP_ALLOW_WRITES: "1" });
    const io = makeIo({ APP_SECRETS: SECRETS, APP_VARS: vars, AUTH_SECRET: "from-the-environment" });
    expect(await runCli(["env", "render", "--from-json-env=APP_SECRETS", "--from-json-env=APP_VARS"], io)).toBe(0);
    expect(readFileSync(join(dir, ".env.prod"), "utf8")).toBe(
      `${ENV_FILE_HEADER}\nAUTH_SECRET=${SECRET}\nDATABASE_URL=postgres://db/override\nMCP_ALLOW_WRITES=1\n`,
    );
    expect(out.join("")).not.toContain(SECRET);
    expect(err).toEqual([]);
  });

  it("does not read a name from the environment, and counts a non-string value as missing", async () => {
    writeCompose(`${COMPOSE}      PORT: \${PORT:?}\n`);
    const io = makeIo({ APP_SECRETS: JSON.stringify({ AUTH_SECRET: SECRET, PORT: 3000 }), DATABASE_URL: "postgres://db/app" });
    expect(await runCli(["env", "render", "--from-json-env=APP_SECRETS"], io)).toBe(1);
    expect(err.join("")).toBe("env render: .env.prod not written; missing in APP_SECRETS: DATABASE_URL, PORT.\n");
    expect(existsSync(join(dir, ".env.prod"))).toBe(false);
  });

  it("refuses a variable that is unset or not a JSON object, naming the variable and never its text", async () => {
    writeCompose();
    expect(await runCli(["env", "render", "--from-json-env=APP_SECRETS"], makeIo({}))).toBe(1);
    expect(await runCli(["env", "render", "--from-json-env=APP_SECRETS"], makeIo({ APP_SECRETS: `["${SECRET}"]` }))).toBe(1);
    expect(await runCli(["env", "render", "--from-json-env=APP_SECRETS"], makeIo({ APP_SECRETS: `${SECRET}{` }))).toBe(1);
    expect(err.join("")).toBe(
      [
        "env render: APP_SECRETS is not set; --from-json-env names a variable holding a JSON object.",
        "env render: APP_SECRETS is not a JSON object of names and values.",
        "env render: APP_SECRETS is not a JSON object of names and values.",
        "",
      ].join("\n"),
    );
    expect(err.join("")).not.toContain(SECRET);
  });
});
