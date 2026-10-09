import { execFile } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { readGoogleFontNames, softureStubsPlugin, softureVitestConfig } from "@softure-ai/testing";

const PACKAGE_DIR = join(import.meta.dirname, "..");
const REPO_ROOT = join(PACKAGE_DIR, "../..");
const run = promisify(execFile);

type Hook = (this: unknown, ...args: unknown[]) => unknown;

function callHook(name: "resolveId" | "load", ...args: unknown[]): unknown {
  const hook = softureStubsPlugin()[name] as Hook;
  return hook.call({}, ...args);
}

describe("softureVitestConfig", () => {
  const savedZone = process.env.TEST_TZ;
  afterEach(() => {
    if (savedZone === undefined) delete process.env.TEST_TZ;
    else process.env.TEST_TZ = savedZone;
  });

  it("inlines @softure-ai packages, lists the clock setup file and adds the stubs", () => {
    const config = softureVitestConfig();
    expect(config.test?.server?.deps?.inline).toEqual([/@softure-ai\//]);
    expect(config.test?.setupFiles).toEqual(["@softure-ai/testing/vitest-setup"]);
    expect(config.plugins?.map((plugin) => (plugin as { name: string }).name)).toEqual(["softure-ai:next-stubs"]);
  });

  it("adds the app's own inline packages and can leave the setup file out", () => {
    const config = softureVitestConfig({ inline: ["esm-only", /^@scope\//], setupFile: false });
    expect(config.test?.server?.deps?.inline).toEqual([/@softure-ai\//, "esm-only", /^@scope\//]);
    expect(config.test).not.toHaveProperty("setupFiles");
  });

  it("pins the test time zone, and TEST_TZ from the shell still wins", () => {
    process.env.TEST_TZ = "";
    softureVitestConfig({ timeZone: "America/New_York" });
    expect(process.env.TEST_TZ).toBe("America/New_York");
    process.env.TEST_TZ = "";
    expect(() => softureVitestConfig({ timeZone: "Mars/Olympus" })).toThrow(RangeError);
    process.env.TEST_TZ = "America/New_York";
    expect(softureVitestConfig({ timeZone: "Asia/Tokyo" }).test?.setupFiles).toHaveLength(1);
    expect(process.env.TEST_TZ).toBe("America/New_York");
  });
});

describe("softureStubsPlugin", () => {
  let dir: string;
  beforeAll(() => {
    dir = mkdtempSync(join(PACKAGE_DIR, ".vitest-preset-"));
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("loads server-only and client-only as empty modules and leaves other modules alone", () => {
    const id = callHook("resolveId", "server-only", "/app/page.ts");
    expect(id).toBe(callHook("resolveId", "client-only", "/app/page.ts"));
    expect(callHook("load", id)).toBe("export {};");
    expect(callHook("resolveId", "next/server", "/app/page.ts")).toBeNull();
    expect(callHook("load", "/app/page.ts")).toBeNull();
  });

  it("exports the Google fonts the importing file asks for", () => {
    const importer = join(dir, "layout.tsx");
    writeFileSync(importer, 'import { Inter, Geist_Mono as Mono } from "next/font/google";\nimport { Inter as Again } from \'next/font/google\';\n');
    expect(readGoogleFontNames(`${importer}?v=1`)).toEqual(["Inter", "Geist_Mono"]);
    const code = callHook("load", callHook("resolveId", "next/font/google", importer)) as string;
    expect(code).toContain('export const Inter = createFont("Inter");');
    expect(code).toContain('export const Geist_Mono = createFont("Geist_Mono");');
  });

  it("gives a file it cannot read no fonts", () => {
    expect(readGoogleFontNames(undefined)).toEqual([]);
    expect(readGoogleFontNames(join(dir, "missing.tsx"))).toEqual([]);
  });
});

describe("the preset in a Vitest run", () => {
  let dir: string;
  beforeAll(() => {
    // Inside the package, so the app resolves @softure-ai/testing and vitest from the repository.
    dir = mkdtempSync(join(PACKAGE_DIR, ".vitest-app-"));
    writeFileSync(
      join(dir, "vitest.config.mts"),
      [
        'import { defineConfig, mergeConfig } from "vitest/config";',
        'import { softureVitestConfig } from "../src/index.ts";',
        "// The packed package lists its setup file by name; from source the test lists the source file.",
        "export default mergeConfig(softureVitestConfig({ timeZone: \"Asia/Tokyo\", setupFile: false }), defineConfig({",
        '  resolve: { conditions: ["@softure-ai/source", "module", "browser", "development|production"] },',
        '  ssr: { resolve: { conditions: ["@softure-ai/source", "module", "node", "development|production"] } },',
        '  test: { include: ["*.check.ts"], setupFiles: ["../src/vitest/setup.ts"] },',
        "}));",
      ].join("\n"),
    );
    writeFileSync(
      join(dir, "fonts.ts"),
      'import "server-only";\nimport { Inter } from "next/font/google";\nimport localFont from "next/font/local";\nexport const inter = Inter({ subsets: ["latin"] });\nexport const local = localFont({ src: "./a.woff2" });\n',
    );
    writeFileSync(
      join(dir, "app.check.ts"),
      [
        'import { expect, it } from "vitest";',
        'import { inter, local } from "./fonts.ts";',
        'it("runs with the stubs and the pinned zone", () => {',
        '  expect(inter).toEqual({ className: "font-inter", variable: "font-inter-variable", style: { fontFamily: "\'Inter\'" } });',
        '  expect(local.className).toBe("font-local");',
        '  expect(process.env.TZ).toBe("Asia/Tokyo");',
        '  expect(new Date().getFullYear()).toBe(2031);',
        "});",
      ].join("\n"),
    );
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("imports server-only and next/font in app code and runs in the given zone", async () => {
    const env = { ...process.env, TEST_TZ: "", TZ: "", TEST_TODAY: "2031-05-06" };
    const { stdout } = await run(join(REPO_ROOT, "node_modules/.bin/vitest"), ["run", "--root", dir], { cwd: dir, env });
    expect(stdout).toMatch(/1 passed/);
  });
});
