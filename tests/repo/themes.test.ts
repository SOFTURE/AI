// The theme package contract (themes/theme-kit/README.md, "The theme package contract"), run for every
// `themes/theme-*` package. A new theme is covered by being created.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { checkTheme, type ThemeDefinition } from "@softure-ai/theme-kit";
import { KIT_STYLESHEETS, parseThemePackageConfig } from "@softure-ai/theme-kit/build";
import { describe, expect, it } from "vitest";

import { REPO_ROOT } from "./repo-files.js";

const KIT_NAME = "@softure-ai/theme-kit";
const KIT_DIR = "themes/theme-kit";
const BUILD = "tsc -p tsconfig.build.json && softure-theme-css";

interface ThemeManifest {
  name?: unknown;
  scripts?: { build?: unknown };
  exports?: Record<string, unknown>;
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  softureTheme?: unknown;
}

const THEME_DIRS = readdirSync(join(REPO_ROOT, "themes"))
  .filter((name) => name.startsWith("theme-") && statSync(join(REPO_ROOT, "themes", name)).isDirectory())
  .map((name) => `themes/${name}`)
  .filter((dir) => dir !== KIT_DIR && existsSync(join(REPO_ROOT, dir, "package.json")));

const CLIENT_DIRECTIVE = /^["']use client["']/;
const CREATES_CONTEXT = /\bcreateContext\b/;
const CALLS_HOOK = /\buse[A-Z]\w*\s*\(/;

// React allows comments before a directive, so they are skipped (a loop, not a regex: no backtracking).
function hasClientDirective(source: string): boolean {
  let rest = source.trimStart();
  for (;;) {
    if (rest.startsWith("//")) {
      const end = rest.indexOf("\n");
      rest = end === -1 ? "" : rest.slice(end + 1).trimStart();
    } else if (rest.startsWith("/*")) {
      const end = rest.indexOf("*/", 2);
      rest = end === -1 ? "" : rest.slice(end + 2).trimStart();
    } else {
      return CLIENT_DIRECTIVE.test(rest);
    }
  }
}

function listSourceFiles(dir: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: "utf8" })
    .filter((name) => /\.tsx?$/.test(name) && !name.endsWith(".d.ts"))
    .map((name) => join(dir, name));
}

// A file that creates a context, or a component file that calls a hook, must be a client module: the package root
// re-exports it, and a Server Component that imports the root would otherwise evaluate it without React's client
// API (issue #770). Plain `.ts` hook modules only define hooks, which runs nothing at import.
function findMissingClientDirectives(srcDir: string): string[] {
  return listSourceFiles(srcDir)
    .filter((file) => {
      const source = readFileSync(file, "utf8");
      const needsClient = CREATES_CONTEXT.test(source) || (file.endsWith(".tsx") && CALLS_HOOK.test(source));
      return needsClient && !hasClientDirective(source);
    })
    .map((file) => file.slice(srcDir.length + 1));
}

// A client module's export is a client reference in a Server Component: rendering a component works, but calling a
// helper or reading a value throws (issue #1005). So a client module exports only components (PascalCase) and hooks;
// helpers and constants live in a plain module.
const COMPONENT_OR_HOOK = /^(?:[A-Z](?=\w*[a-z])|use[A-Z])\w*$/;
const DECLARED_EXPORT = /^export\s+(?:async\s+)?(?:function\*?|const|let|var|class)\s+(\w+)/gm;
const LISTED_EXPORT = /^export\s+\{([^}]*)\}/gm;

// Known exceptions, "<theme dir>/<file>: <name>", each with its reason.
const CLIENT_VALUE_EXPORTS_ALLOWED = new Set([
  // The pinned shadcn new-york v4 tabs.tsx exports its cva builder from the client module; tracked in issue #1008.
  "themes/theme-notion/ui/tabs.tsx: tabsListVariants",
]);

function listExportedNames(source: string): string[] {
  const declared = [...source.matchAll(DECLARED_EXPORT)].map((match) => match[1] ?? "");
  const listed = [...source.matchAll(LISTED_EXPORT)].flatMap((match) =>
    (match[1] ?? "")
      .split(",")
      .map((part) => part.trim())
      .filter((part) => part !== "" && !part.startsWith("type "))
      .map((part) => part.split(/\s+as\s+/).pop() ?? part),
  );
  return [...declared, ...listed];
}

function findClientValueExports(dir: string): string[] {
  const srcDir = join(REPO_ROOT, dir, "src");
  return listSourceFiles(srcDir).flatMap((file) => {
    const source = readFileSync(file, "utf8");
    if (!hasClientDirective(source)) return [];
    const relative = file.slice(srcDir.length + 1);
    return listExportedNames(source)
      .filter((name) => !COMPONENT_OR_HOOK.test(name))
      .map((name) => `${dir}/${relative}: ${name}`)
      .filter((entry) => !CLIENT_VALUE_EXPORTS_ALLOWED.has(entry));
  });
}

function readManifest(dir: string): ThemeManifest {
  return JSON.parse(readFileSync(join(REPO_ROOT, dir, "package.json"), "utf8")) as ThemeManifest;
}

describe("theme packages", () => {
  it("finds at least the Notion theme", () => {
    expect(THEME_DIRS).toContain("themes/theme-notion");
  });

  describe.each(THEME_DIRS)("%s", (dir) => {
    const manifest = readManifest(dir);

    it("depends on the kit and takes Tailwind CSS v4 and React from the app", () => {
      expect([
        typeof manifest.dependencies?.[KIT_NAME],
        manifest.peerDependencies?.tailwindcss,
        typeof manifest.peerDependencies?.react,
      ]).toEqual(["string", "^4.0.0", "string"]);
    });

    it("builds its CSS with the kit's command and ships theme.css", () => {
      expect([manifest.scripts?.build, manifest.exports?.["./theme.css"]]).toEqual([BUILD, "./dist/theme.css"]);
    });

    it("exports the kit's page stylesheets under its own name, so an app imports CSS only from the theme", () => {
      expect(KIT_STYLESHEETS.map((name) => manifest.exports?.[`./${name}`])).toEqual(KIT_STYLESHEETS.map((name) => `./dist/${name}`));
    });

    it("declares a valid softureTheme whose folders and stylesheets exist and are exported", () => {
      const parsed = parseThemePackageConfig(manifest.softureTheme);
      expect(parsed.ok ? "ok" : parsed.error).toBe("ok");
      if (!parsed.ok) return;
      for (const source of parsed.config.sources) {
        expect([source, existsSync(join(REPO_ROOT, dir, "src", source))]).toEqual([source, true]);
      }
      for (const name of parsed.config.stylesheets) {
        expect([name, existsSync(join(REPO_ROOT, dir, "src", name)), manifest.exports?.[`./${name}`]]).toEqual([
          name,
          true,
          `./dist/${name}`,
        ]);
      }
    });

    it("marks every source file with a context or a component hook as a client module", () => {
      expect(findMissingClientDirectives(join(REPO_ROOT, dir, "src"))).toEqual([]);
    });

    it("exports only components and hooks from its client modules, so helpers work in Server Components", () => {
      expect(findClientValueExports(dir)).toEqual([]);
    });

    it("exports a theme that meets the contract from src/tokens.ts, and theme and cn from its entry", async () => {
      const tokens = (await import(pathToFileURL(join(REPO_ROOT, dir, "src/tokens.ts")).href)) as { theme?: ThemeDefinition };
      const entry = (await import(pathToFileURL(join(REPO_ROOT, dir, "src/index.ts")).href)) as Record<string, unknown>;
      expect(tokens.theme === undefined ? ["no theme export"] : checkTheme(tokens.theme)).toEqual([]);
      expect([entry.theme === tokens.theme, typeof entry.cn]).toEqual([true, "function"]);
    });
  });
});
