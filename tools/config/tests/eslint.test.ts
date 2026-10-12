import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { ESLint, type Linter } from "eslint";
import tseslint from "typescript-eslint";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createSoftureEslintConfig, type SoftureEslintOptions } from "../src/eslint/index.js";

const APP_IMPORT = 'import { db } from "@/lib/db";\nexport const value: unknown = db;\n';
const PLAYWRIGHT_IMPORT = 'import { test } from "@playwright/test";\nexport const value: unknown = test;\n';
const FLOATING_PROMISE = "export async function load(): Promise<void> {}\nload();\n";
const JS_MODULE = "const config = {};\nexport default config;\n";
// typescript-eslint types its parser loosely (one argument); the real function takes the parser options too.
const parseTypeScript = tseslint.parser.parseForESLint.bind(tseslint.parser) as (
  code: string,
  options: object,
) => Linter.ESLintParseResult;
/** A parser that gives no type information, standing in for the Babel parser Next sets on every file. */
const UNTYPED_PARSER: Linter.Parser = {
  meta: { name: "untyped-parser" },
  parseForESLint: (code: string, options: object) => parseTypeScript(code, { ...options, projectService: false, project: null }),
};
const OTHER_PARSER: Linter.Config = { files: ["**/*.{js,mjs,ts,tsx,mts,cts}"], languageOptions: { parser: UNTYPED_PARSER } };
const PLAYWRIGHT_EXPECT = 'import { expect } from "@playwright/test";\nexport const value: unknown = expect;\n';

describe("createSoftureEslintConfig", () => {
  let appDir = "";

  beforeAll(() => {
    appDir = mkdtempSync(join(tmpdir(), "softure-eslint-"));
    writeFileSync(
      join(appDir, "tsconfig.json"),
      JSON.stringify({ compilerOptions: { strict: true, noEmit: true, module: "ESNext", moduleResolution: "Bundler" }, include: ["**/*.ts", "**/*.mts"] }),
    );
  });

  afterAll(() => rmSync(appDir, { recursive: true, force: true }));

  /** Rule ids ESLint reports for `text` saved at the app-relative `path`. */
  async function lint(path: string, text: string, options: Omit<SoftureEslintOptions, "tsconfigRootDir"> = {}): Promise<(string | null)[]> {
    const filePath = join(appDir, path);
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, text);
    const eslint = new ESLint({
      cwd: appDir,
      overrideConfigFile: true,
      overrideConfig: createSoftureEslintConfig({ tsconfigRootDir: appDir, ...options }),
    });
    const [result] = await eslint.lintFiles([filePath]);
    return result?.messages.map((message) => message.ruleId) ?? [];
  }

  it("runs the type-checked TypeScript rules", async () => {
    expect(await lint("lib/any.ts", "export async function load(): Promise<void> {}\nload();\n")).toContain(
      "@typescript-eslint/no-floating-promises",
    );
  });

  it("runs no type-checked rule on JavaScript files, which have no type information", async () => {
    expect(await lint("eslint.config.mjs", JS_MODULE)).toEqual([]);
    expect(await lint("scripts/run.mjs", "async function load() {}\nload();\n")).toEqual([]);
  });

  it("covers every TypeScript extension with the type-checked rules", async () => {
    expect(await lint("lib/module.mts", FLOATING_PROMISE)).toContain("@typescript-eslint/no-floating-promises");
  });

  describe("next to a config that sets its own parser, as Next's does", () => {
    it("lints JavaScript files without asking for type information", async () => {
      expect(await lint("postcss.config.mjs", JS_MODULE, { extends: [OTHER_PARSER] })).toEqual([]);
    });

    it("keeps typescript-eslint's parser and the type-checked rules on TypeScript files", async () => {
      expect(await lint("lib/next.ts", FLOATING_PROMISE, { extends: [OTHER_PARSER] })).toContain(
        "@typescript-eslint/no-floating-promises",
      );
    });
  });

  it("reuses the @typescript-eslint plugin an extended config registers, so a second copy does not clash", async () => {
    const otherCopy: Linter.Config = { files: ["**/*.ts"], plugins: { "@typescript-eslint": { ...tseslint.plugin } } };
    expect(await lint("lib/copy.ts", FLOATING_PROMISE, { extends: [otherCopy] })).toContain(
      "@typescript-eslint/no-floating-promises",
    );
  });

  it("keeps integration tests from importing the app's source", async () => {
    expect(await lint("integration/login.test.ts", APP_IMPORT)).toContain("no-restricted-imports");
    expect(await lint("lib/page.ts", APP_IMPORT)).not.toContain("no-restricted-imports");
  });

  it("takes the app's own source patterns and integration folder", async () => {
    const integration = { files: ["tests/integration/**"], appSource: ["**/src/**"] };
    expect(await lint("tests/integration/a.test.ts", 'import { b } from "../../src/b";\nexport const c: unknown = b;\n', { integration })).toContain(
      "no-restricted-imports",
    );
    expect(await lint("integration/a.test.ts", APP_IMPORT, { integration })).not.toContain("no-restricted-imports");
  });

  it("turns the integration boundary off with false", async () => {
    expect(await lint("integration/login.test.ts", APP_IMPORT, { integration: false })).not.toContain("no-restricted-imports");
  });

  it("leaves Playwright's test alone until the fixtures module is named", async () => {
    expect(await lint("e2e/home.test.ts", PLAYWRIGHT_IMPORT)).not.toContain("no-restricted-imports");
  });

  describe("with a fixtures module", () => {
    const fixtures = { module: "./fixtures", exempt: ["e2e/fixtures.ts"] };

    it("makes e2e and integration tests take test from the fixtures", async () => {
      expect(await lint("e2e/home.test.ts", PLAYWRIGHT_IMPORT, { fixtures })).toContain("no-restricted-imports");
      expect(await lint("integration/home.test.ts", PLAYWRIGHT_IMPORT, { fixtures })).toContain("no-restricted-imports");
    });

    it("keeps the black box rule in integration tests beside it", async () => {
      expect(await lint("integration/login.test.ts", APP_IMPORT, { fixtures })).toContain("no-restricted-imports");
    });

    it("still allows expect and the other Playwright exports", async () => {
      expect(await lint("e2e/home.test.ts", PLAYWRIGHT_EXPECT, { fixtures })).not.toContain("no-restricted-imports");
    });

    it("lets the fixtures module itself extend Playwright's test", async () => {
      expect(await lint("e2e/fixtures.ts", PLAYWRIGHT_IMPORT, { fixtures })).not.toContain("no-restricted-imports");
    });
  });

  it("ignores the build output and adds the app's own ignores", async () => {
    const eslint = new ESLint({
      cwd: appDir,
      overrideConfigFile: true,
      overrideConfig: createSoftureEslintConfig({ tsconfigRootDir: appDir, ignores: ["generated/**"] }),
    });
    expect(await eslint.isPathIgnored(join(appDir, ".next/server/page.js"))).toBe(true);
    expect(await eslint.isPathIgnored(join(appDir, "generated/client.ts"))).toBe(true);
    expect(await eslint.isPathIgnored(join(appDir, "lib/page.ts"))).toBe(false);
  });

  it("places the app's extra configs after the base rules, so they win", async () => {
    const extra = { rules: { "@typescript-eslint/no-floating-promises": "off" as const } };
    expect(await lint("lib/off.ts", FLOATING_PROMISE, { extends: [extra] })).toEqual([]);
  });
});
