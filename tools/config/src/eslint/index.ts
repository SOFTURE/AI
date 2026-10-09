// ESLint flat config preset for a SOFTURE app: recommended JS and type-checked TypeScript rules,
// the build output ignored, and two test rules (integration tests as a black box, `test` from the
// app's fixtures). Next.js rules come in through `extends`, so the preset needs no Next package.
import js from "@eslint/js";
import type { Linter } from "eslint";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

export interface IntegrationBoundary {
  /** The integration tests. Default: `integration/**`. */
  files?: string[];
  /** Import patterns (gitignore style, as in `no-restricted-imports`) that reach the app's source. Default: `@/*`. */
  appSource?: string[];
}

export interface FixturesImport {
  /** The module the tests take `test` from instead of `@playwright/test`, e.g. `./fixtures` or a package. */
  module: string;
  /** The test files the rule covers. Default: `e2e/**` and `integration/**`. */
  files?: string[];
  /** Files that may import `test` from `@playwright/test`: the fixtures module itself. */
  exempt?: string[];
}

export interface SoftureEslintOptions {
  /** The folder of the app's tsconfig.json, for type-checked rules: `import.meta.dirname` in eslint.config.mjs. */
  tsconfigRootDir: string;
  /** Configs placed after the preset's base rules, e.g. Next's `core-web-vitals` flat config. */
  extends?: Linter.Config[];
  /** Ignored paths on top of the build output. */
  ignores?: string[];
  /** Integration tests import nothing from the app's source; `false` turns the rule off. */
  integration?: IntegrationBoundary | false;
  /** Tests take `test` from the app's fixtures; off when not given. */
  fixtures?: FixturesImport;
}

export const DEFAULT_IGNORES = [
  "**/dist/**",
  "**/.next/**",
  "**/next-env.d.ts",
  "coverage/**",
  "test-results/**",
  "playwright-report/**",
];
export const DEFAULT_INTEGRATION_FILES = ["integration/**"];
export const DEFAULT_APP_SOURCE = ["@/*"];
export const DEFAULT_FIXTURES_FILES = ["e2e/**", "integration/**"];

const RULE = "no-restricted-imports";

interface RestrictedImports {
  paths: { name: string; importNames?: string[]; message: string }[];
  patterns: { group: string[]; message: string }[];
}

function getFixturesPaths(fixtures: FixturesImport): RestrictedImports["paths"] {
  return [
    {
      name: "@playwright/test",
      importNames: ["test"],
      message: `Import test from ${fixtures.module}: the app's fixtures extend Playwright's test.`,
    },
  ];
}

function getAppSourcePatterns(integration: IntegrationBoundary): RestrictedImports["patterns"] {
  return [
    {
      group: integration.appSource ?? DEFAULT_APP_SOURCE,
      message: "Integration tests are a black box: drive the app through HTTP and the browser, not its source.",
    },
  ];
}

function toRule(restricted: RestrictedImports): Linter.RuleEntry {
  return ["error", restricted];
}

/**
 * The test rules as config objects. ESLint lets the last matching object set a rule's options,
 * so the integration files get the fixtures rule and the black box rule in one entry.
 */
function getTestImportConfigs(options: SoftureEslintOptions): Linter.Config[] {
  const integration = options.integration === false ? null : (options.integration ?? {});
  const { fixtures } = options;
  const configs: Linter.Config[] = [];
  if (fixtures) {
    configs.push({
      name: "softure/fixtures-import",
      files: fixtures.files ?? DEFAULT_FIXTURES_FILES,
      rules: { [RULE]: toRule({ paths: getFixturesPaths(fixtures), patterns: [] }) },
    });
  }
  if (integration) {
    configs.push({
      name: "softure/integration-black-box",
      files: integration.files ?? DEFAULT_INTEGRATION_FILES,
      rules: {
        [RULE]: toRule({
          paths: fixtures ? getFixturesPaths(fixtures) : [],
          patterns: getAppSourcePatterns(integration),
        }),
      },
    });
  }
  if (fixtures?.exempt?.length) {
    configs.push({ name: "softure/fixtures-module", files: fixtures.exempt, rules: { [RULE]: "off" } });
  }
  return configs;
}

/** The app's whole flat config: `export default createSoftureEslintConfig({ tsconfigRootDir: import.meta.dirname })`. */
export function createSoftureEslintConfig(options: SoftureEslintOptions): Linter.Config[] {
  return defineConfig([
    globalIgnores([...DEFAULT_IGNORES, ...(options.ignores ?? [])]),
    js.configs.recommended,
    tseslint.configs.recommendedTypeChecked,
    {
      name: "softure/language-options",
      languageOptions: {
        globals: { ...globals.browser, ...globals.node },
        parserOptions: { projectService: true, tsconfigRootDir: options.tsconfigRootDir },
      },
    },
    ...(options.extends ?? []),
    ...getTestImportConfigs(options),
  ]);
}
