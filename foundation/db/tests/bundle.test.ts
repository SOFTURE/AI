// The container path end to end, on real Node (not Vite): esbuild bundles an app's migrate script
// and the `softure` bin with the drivers external, the build stage exports the module files, and
// the bundles migrate a fresh database from that export.
import { execFile } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { build } from "esbuild";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabase } from "@softure-ai/db";
import { runMigrateCli } from "@softure-ai/db/cli";
import config from "./fixtures/bundle-config.js";
import { readLedger } from "./support/query.js";

const runFile = promisify(execFile);
const REPO_ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const FIXTURES = fileURLToPath(new URL("./fixtures/", import.meta.url));

// Inside the repository, so the external drivers resolve from its node_modules like in an image.
let bundleDir = "";
let workDir = "";

beforeAll(async () => {
  const cacheDir = join(REPO_ROOT, "node_modules/.cache");
  mkdirSync(cacheDir, { recursive: true });
  bundleDir = mkdtempSync(join(cacheDir, "softure-db-bundle-"));
  workDir = mkdtempSync(join(tmpdir(), "softure-db-bundle-work-"));
  await build({
    entryPoints: {
      migrate: join(FIXTURES, "bundle-entry.ts"),
      config: join(FIXTURES, "bundle-config.ts"),
      bin: fileURLToPath(new URL("../src/cli/bin.ts", import.meta.url)),
    },
    outdir: bundleDir,
    outExtension: { ".js": ".mjs" },
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node22",
    external: ["pg", "@electric-sql/pglite"],
    // CI's test job has no dist/: read workspace packages from their sources, as Vitest does.
    conditions: ["@softure-ai/source"],
    logLevel: "silent",
  });
  const exported = await runMigrateCli({
    config,
    argv: ["--export-migrations", join(workDir, "migrations")],
    output: { log: () => undefined, error: (line) => console.error(line) },
  });
  expect(exported).toBe(0);
});

afterAll(() => {
  rmSync(bundleDir, { recursive: true, force: true });
  rmSync(workDir, { recursive: true, force: true });
});

async function readLedgerAt(dataDir: string): Promise<string[]> {
  const handle = await createDatabase(`pglite://${dataDir}`);
  try {
    return (await readLedger(handle)).map((row) => `${row.module}/${row.version}`);
  } finally {
    await handle.close();
  }
}

describe("the bundled migrate step", () => {
  it("keeps the drivers external", () => {
    const bundle = readFileSync(join(bundleDir, "migrate.mjs"), "utf8");

    expect(bundle).toMatch(/import\("pg"\)/);
    expect(bundle).toMatch(/import\("@electric-sql\/pglite"\)/);
  });

  it("migrates a database from the exported files", async () => {
    const dataDir = join(workDir, "app-data");

    const { stdout } = await runFile(process.execPath, [join(bundleDir, "migrate.mjs"), "--migrations-dir", join(workDir, "migrations")], {
      cwd: workDir,
      env: { ...process.env, SOFTURE_FIXTURE_DATABASE_URL: `pglite://${dataDir}` },
    });

    expect(stdout.trim().split("\n").at(-1)).toBe("4 migration(s) applied");
    expect(await readLedgerAt(dataDir)).toEqual(["softure/1", "notes/1", "notes/2", "tags/1"]);
  });

  it("runs the bundled softure bin with a config file", async () => {
    const dataDir = join(workDir, "bin-data");
    const args = [join(bundleDir, "bin.mjs"), "migrate", "--config", join(bundleDir, "config.mjs"), "--migrations-dir", "migrations"];

    const { stdout } = await runFile(process.execPath, args, {
      cwd: workDir,
      env: { ...process.env, SOFTURE_FIXTURE_DATABASE_URL: `pglite://${dataDir}` },
    });

    expect(stdout.trim().split("\n").at(-1)).toBe("4 migration(s) applied");
    expect(await readLedgerAt(dataDir)).toEqual(["softure/1", "notes/1", "notes/2", "tags/1"]);
  });

  it("exits 1 and names the problem when the export is missing", async () => {
    const attempt = runFile(process.execPath, [join(bundleDir, "migrate.mjs"), "--migrations-dir", join(workDir, "nowhere")], {
      cwd: workDir,
      env: { ...process.env, SOFTURE_FIXTURE_DATABASE_URL: "pglite://" },
    });

    const failure = (await attempt.then(
      () => null,
      (error: unknown) => error,
    )) as { code?: number; stderr?: string } | null;

    expect(failure?.code).toBe(1);
    expect(failure?.stderr).toContain("notes: cannot read the migrations folder");
  });
});
