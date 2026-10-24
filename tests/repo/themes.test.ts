// The theme package contract (themes/theme-kit/README.md, "The theme package contract"), run for every
// `themes/theme-*` package. A new theme is covered by being created.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { checkTheme, type ThemeDefinition } from "@softure-ai/theme-kit";
import { parseThemePackageConfig } from "@softure-ai/theme-kit/build";
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

    it("exports a theme that meets the contract from src/tokens.ts, and theme and cn from its entry", async () => {
      const tokens = (await import(pathToFileURL(join(REPO_ROOT, dir, "src/tokens.ts")).href)) as { theme?: ThemeDefinition };
      const entry = (await import(pathToFileURL(join(REPO_ROOT, dir, "src/index.ts")).href)) as Record<string, unknown>;
      expect(tokens.theme === undefined ? ["no theme export"] : checkTheme(tokens.theme)).toEqual([]);
      expect([entry.theme === tokens.theme, typeof entry.cn]).toEqual([true, "function"]);
    });
  });
});
