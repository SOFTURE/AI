// The config loading every module command shares (`@softure-ai/core/cli`): the `--config` option, the
// default file names and the import of the app's config, with the exact texts the bins print.
import { copyFileSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_CONFIG_FILES, findDefaultConfig, loadAppConfig, loadConfig, takeConfigOption } from "@softure-ai/core/cli";
import { afterEach, describe, expect, it } from "vitest";

const APP_SCRIPT = { runner: "runExampleCli", packageName: "@softure-ai/example" };
const CONFIG_SOURCE = 'export default { database: null, locale: "en", timezone: "Europe/Warsaw", appOrigin: "http://localhost:3000", modules: [] };\n';

const FIXTURES = new URL("./fixtures/cli/", import.meta.url);

const cleanups: (() => void)[] = [];

afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
});

/** A temporary app folder with these files; the path ends with a separator. */
function createAppDir(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "softure-core-cli-"));
  cleanups.push(() => rmSync(dir, { recursive: true, force: true }));
  for (const [name, source] of Object.entries(files)) writeFileSync(join(dir, name), source);
  return `${dir}/`;
}

describe("takeConfigOption", () => {
  it("takes --config <file> and --config=<file> out of the arguments, keeping the rest in order", () => {
    expect(takeConfigOption(["publish", "--config", "app.mjs", "--commit"])).toEqual({ ok: true, configPath: "app.mjs", argv: ["publish", "--commit"] });
    expect(takeConfigOption(["--config=app.mjs", "check", "a.md"])).toEqual({ ok: true, configPath: "app.mjs", argv: ["check", "a.md"] });
  });

  it("leaves the path undefined without the option", () => {
    expect(takeConfigOption([])).toEqual({ ok: true, configPath: undefined, argv: [] });
    expect(takeConfigOption(["--plan"])).toEqual({ ok: true, configPath: undefined, argv: ["--plan"] });
  });

  it("refuses --config without a path, at the end or before another option", () => {
    expect(takeConfigOption(["--config"])).toEqual({ ok: false, problem: "--config needs a file path" });
    expect(takeConfigOption(["--config", "--plan"])).toEqual({ ok: false, problem: "--config needs a file path" });
  });
});

describe("findDefaultConfig", () => {
  it("lists the default names in lookup order", () => {
    expect(DEFAULT_CONFIG_FILES).toEqual(["softure.config.ts", "softure.config.mts", "softure.config.js", "softure.config.mjs"]);
  });

  it("returns the first default name that exists", () => {
    const dir = createAppDir({ "softure.config.mjs": CONFIG_SOURCE, "softure.config.js": CONFIG_SOURCE });
    expect(findDefaultConfig(dir)).toBe(join(dir, "softure.config.js"));
  });

  it("returns undefined when none exists", () => {
    expect(findDefaultConfig(createAppDir({ "other.mjs": CONFIG_SOURCE }))).toBeUndefined();
  });
});

describe("loadConfig", () => {
  it("loads the default export and an export named config", async () => {
    const dir = createAppDir({ "a.mjs": CONFIG_SOURCE, "b.mjs": CONFIG_SOURCE.replace("export default", "export const config =") });
    const byDefault = await loadConfig(join(dir, "a.mjs"), APP_SCRIPT);
    const byName = await loadConfig(join(dir, "b.mjs"), APP_SCRIPT);
    expect(byDefault).toMatchObject({ ok: true, config: { database: null, modules: [] } });
    expect(byName).toMatchObject({ ok: true, config: { appOrigin: "http://localhost:3000" } });
  });

  it("says a missing file does not exist", async () => {
    const path = join(createAppDir({}), "nowhere.mjs");
    expect(await loadConfig(path, APP_SCRIPT)).toEqual({ ok: false, problem: `config file ${path} does not exist` });
  });

  it("refuses an export that is not a config: no modules, or no database key", async () => {
    const dir = createAppDir({ "no-modules.mjs": "export default { database: null };\n", "no-database.mjs": "export default { modules: [] };\n" });
    for (const name of ["no-modules.mjs", "no-database.mjs"]) {
      const path = join(dir, name);
      expect(await loadConfig(path, APP_SCRIPT)).toEqual({
        ok: false,
        problem: `${path} must export (default or as "config") the result of defineSoftureConfig`,
      });
    }
  });

  it("names the app-script fallback when the import fails", async () => {
    const path = join(createAppDir({ "broken.mjs": 'throw new Error("boom");\n' }), "broken.mjs");
    expect(await loadConfig(path, APP_SCRIPT)).toEqual({
      ok: false,
      problem: `cannot load ${path}: boom. If Node cannot run this file, call runExampleCli from an app script (see the @softure-ai/example README).`,
    });
  });
});

describe("loadAppConfig", () => {
  it("resolves --config against the working directory", async () => {
    const dir = createAppDir({ "named.mjs": CONFIG_SOURCE });
    expect(await loadAppConfig({ cwd: dir, configPath: "named.mjs", appScript: APP_SCRIPT })).toMatchObject({ ok: true, config: { modules: [] } });
    expect(await loadAppConfig({ cwd: dir, configPath: "nowhere.mjs", appScript: APP_SCRIPT })).toEqual({
      ok: false,
      problem: `config file ${dir}nowhere.mjs does not exist`,
    });
  });

  it("finds a default config without --config", async () => {
    const dir = createAppDir({ "softure.config.mjs": CONFIG_SOURCE });
    expect(await loadAppConfig({ cwd: dir, configPath: undefined, appScript: APP_SCRIPT })).toMatchObject({ ok: true });
  });

  it("says where it looked when there is no config", async () => {
    const dir = createAppDir({});
    expect(await loadAppConfig({ cwd: dir, configPath: undefined, appScript: APP_SCRIPT })).toEqual({
      ok: false,
      problem: `no config found; looked for softure.config.ts, softure.config.mts, softure.config.js, softure.config.mjs in ${dir}; pass --config <file>`,
    });
  });

  /** A fresh copy of the fixture config without a database URL, inside the package so it resolves core. */
  function copyConfigWithoutDatabase(): string {
    const dir = mkdtempSync(fileURLToPath(new URL("tmp-", FIXTURES)));
    cleanups.push(() => rmSync(dir, { recursive: true, force: true }));
    copyFileSync(new URL("without-database.config.mjs", FIXTURES), join(dir, "softure.config.mjs"));
    return dir;
  }

  it("loads a config without a database URL when the command makes the database optional", async () => {
    expect(process.env.SOFTURE_FIXTURE_UNSET_DATABASE_URL).toBeUndefined();
    const loaded = await loadAppConfig({ cwd: copyConfigWithoutDatabase(), configPath: undefined, appScript: APP_SCRIPT, database: "optional" });
    expect(loaded).toMatchObject({ ok: true, config: { database: null, modules: [{ id: "notes" }] } });
  });

  it("requires the database by default", async () => {
    const loaded = await loadAppConfig({ cwd: copyConfigWithoutDatabase(), configPath: undefined, appScript: APP_SCRIPT });
    expect(loaded).toMatchObject({ ok: false });
    expect(loaded.ok ? "" : loaded.problem).toContain("database.url: must not be empty");
  });
});
