// Vitest preset for a Next.js app on SOFTURE packages: the settings every such app otherwise copies
// into its `vitest.config.*`. Merge it with the app's own config:
//
//   export default mergeConfig(softureVitestConfig(), defineConfig({ test: { include: ["tests/**/*.test.ts"] } }));
import { readFileSync } from "node:fs";
import { configDefaults, type Plugin, type TestProjectInlineConfiguration, type ViteUserConfig } from "vitest/config";
import { pinTestTimeZone } from "./time-zone.js";

export interface SoftureVitestOptions {
  /** The zone the tests run in, unless `TEST_TZ` names another. Default: `America/New_York`. */
  timeZone?: string;
  /** Packages Vitest transforms on top of `@softure-ai/*`, e.g. another ESM-only package. */
  inline?: readonly (string | RegExp)[];
  /** `false` leaves out the clock setup file, for an app that imports it from its own setup file. */
  setupFile?: boolean;
  /**
   * `true` splits the tests into two projects: `dom` runs `*.dom.test.*` files in happy-dom with the DOM setup file,
   * `node` runs every other test. Needs the optional peers `happy-dom`, `@testing-library/react`,
   * `@testing-library/dom` and `@testing-library/user-event`.
   */
  dom?: boolean;
}

/** The setup file the preset lists: pins the time zone and shifts the clock to `TEST_TODAY`. */
export const VITEST_SETUP_FILE = "@softure-ai/testing/vitest-setup";

/** The setup file of the `dom` project: unmounts what a test rendered after each test. */
export const VITEST_DOM_SETUP_FILE = "@softure-ai/testing/vitest-dom-setup";

/** The files the `dom` project runs: `menu.dom.test.tsx`, `form.dom.test.ts`. */
export const DOM_TEST_PATTERN = "**/*.dom.test.?(c|m)[jt]s?(x)";

// Projects inherit the app's `include` and add their own to it, so the `dom` project narrows the inherited list with
// an `exclude` of every other script file. The extension anchors it to files: without it the pattern matches folder
// names too and prunes the whole tree.
const NOT_DOM_TEST_PATTERN = "**/!(*.dom.test).?(c|m)[jt]s?(x)";

/**
 * Pins the test time zone (in the main process, so it holds in every pool) and returns the config:
 * Vitest transforms the `@softure-ai/*` packages (they ship ESM that imports `next/*` without
 * extensions), `server-only` and `client-only` load as empty modules, `next/font/google` and
 * `next/font/local` return stub fonts, and the clock setup file runs before the tests. With `dom`, `*.dom.test.*`
 * files run in happy-dom.
 */
export function softureVitestConfig(options: SoftureVitestOptions = {}): ViteUserConfig {
  pinTestTimeZone(options.timeZone);
  return {
    plugins: [softureStubsPlugin()],
    test: {
      server: { deps: { inline: [/@softure-ai\//, ...(options.inline ?? [])] } },
      ...(options.setupFile === false ? {} : { setupFiles: [VITEST_SETUP_FILE] }),
      ...(options.dom === true ? { projects: getDomProjects() } : {}),
    },
  };
}

/** The `node` and `dom` projects of `dom: true`; both extend the config that lists them. */
function getDomProjects(): TestProjectInlineConfiguration[] {
  return [
    { extends: true, test: { name: "node", exclude: [...configDefaults.exclude, "**/*.dom.test.*"] } },
    {
      extends: true,
      test: {
        name: "dom",
        environment: "happy-dom",
        include: [DOM_TEST_PATTERN],
        exclude: [...configDefaults.exclude, NOT_DOM_TEST_PATTERN],
        setupFiles: [VITEST_DOM_SETUP_FILE],
      },
    },
  ];
}

const PREFIX = "\0softure-ai-stub:";
const EMPTY_MODULES = new Set(["server-only", "client-only"]);
const GOOGLE_FONTS = "next/font/google";
const LOCAL_FONT = "next/font/local";

/**
 * Stubs for modules that only work inside a Next.js build. `next/font/google` exports one function
 * per font, so the stub exports the names the importing file asks for.
 */
export function softureStubsPlugin(): Plugin {
  return {
    name: "softure-ai:next-stubs",
    enforce: "pre",
    resolveId(source, importer) {
      if (EMPTY_MODULES.has(source)) return `${PREFIX}empty`;
      if (source === LOCAL_FONT) return `${PREFIX}font-local`;
      if (source === GOOGLE_FONTS) return `${PREFIX}font-google:${readGoogleFontNames(importer).join(",")}`;
      return null;
    },
    load(id) {
      if (!id.startsWith(PREFIX)) return null;
      const stub = id.slice(PREFIX.length);
      if (stub === "empty") return "export {};";
      if (stub === "font-local") return `${FONT_FACTORY}\nexport default createFont("local");`;
      const names = stub.slice("font-google:".length).split(",").filter(Boolean);
      return [FONT_FACTORY, ...names.map((name) => `export const ${name} = createFont(${JSON.stringify(name)});`)].join("\n");
    },
  };
}

/** What a `next/font` loader returns: a class name, a class that defines the CSS variable, and a style. */
const FONT_FACTORY = `function createFont(family) {
  const slug = family.replace(/_/g, "-").toLowerCase();
  return () => ({ className: "font-" + slug, variable: "font-" + slug + "-variable", style: { fontFamily: "'" + family.replace(/_/g, " ") + "'" } });
}`;

/** The fonts a file imports from `next/font/google`: `import { Inter, Geist_Mono as Mono } from …`. */
export function readGoogleFontNames(importer: string | undefined): string[] {
  if (importer === undefined) return [];
  const end = importer.search(/[?#]/);
  const path = end === -1 ? importer : importer.slice(0, end);
  let source: string;
  try {
    source = readFileSync(path, "utf8");
  } catch {
    // A virtual importer has no file: it gets a module without fonts, and a named import fails loudly.
    return [];
  }
  const names = [...source.matchAll(/import\s*\{([^}]*)\}\s*from\s*["']next\/font\/google["']/g)].flatMap((match) =>
    (match[1] ?? "").split(",").map((part) => part.trim().split(/\s+as\s+/)[0]?.trim() ?? ""),
  );
  return [...new Set(names.filter((name) => /^[A-Za-z_$][\w$]*$/.test(name)))];
}
