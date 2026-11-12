import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * The kit as an adopting app loads it: its built `dist/`, through the package's exports, bundled by Turbopack in a
 * Next.js server. 0.36.0 passed every test here and still broke every page of such an app: a font path written as
 * `new URL(…, import.meta.url)` became a bundler asset object that `fileURLToPath` refused. This test builds the
 * fixture app of `fixtures/next-app/` against the kit compiled from its current sources, so a module that cannot load
 * under the bundler fails here, before a release. The fixture has a manifest of its own: inside the kit's folder without
 * one, its import would resolve to the kit itself (a package self-reference) instead of the copy installed for it.
 */
const ROOT = join(import.meta.dirname, "..");
const REPOSITORY = join(ROOT, "..", "..");
const APP = join(import.meta.dirname, "fixtures", "next-app");
const INSTALLED = join(APP, "node_modules", "@softure-ai", "marketing-kit");

/** Copies the kit into the fixture's own `node_modules` as npm would install it: the manifest, the fonts, a fresh build. */
function installKit(): void {
  rmSync(join(APP, "node_modules"), { recursive: true, force: true });
  mkdirSync(INSTALLED, { recursive: true });
  cpSync(join(ROOT, "package.json"), join(INSTALLED, "package.json"));
  cpSync(join(ROOT, "fonts"), join(INSTALLED, "fonts"), { recursive: true });
  const tsc = spawnSync(
    process.execPath,
    [
      join(REPOSITORY, "node_modules", "typescript", "bin", "tsc6"),
      ...["-p", join(ROOT, "tsconfig.build.json"), "--outDir", join(INSTALLED, "dist")],
      ...["--declaration", "false", "--declarationMap", "false", "--sourceMap", "false", "--incremental", "false"],
    ],
    { encoding: "utf8" },
  );
  if (tsc.status !== 0) throw new Error(`compiling the kit for the bundler fixture failed:\n${tsc.stdout}${tsc.stderr}`);
}

function removeBuild(): void {
  rmSync(join(APP, "node_modules"), { recursive: true, force: true });
  rmSync(join(APP, ".next"), { recursive: true, force: true });
}

/** The text of one element of the prerendered page, by its id. */
function readElement(html: string, id: string): string | undefined {
  return new RegExp(`id="${id}">([^<]*)<`).exec(html)?.[1];
}

describe("the kit under a bundler (Next.js with Turbopack)", () => {
  let build: { status: number | null; output: string };

  beforeAll(() => {
    removeBuild();
    installKit();
    const result = spawnSync(process.execPath, [join(REPOSITORY, "node_modules", "next", "dist", "bin", "next"), "build", APP], {
      encoding: "utf8",
      env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1", NODE_ENV: "production" },
    });
    build = { status: result.status, output: `${result.stdout}${result.stderr}` };
  }, 300_000);

  afterAll(removeBuild);

  it("builds a server page that imports both entry points", () => {
    expect(build.status, build.output).toBe(0);
  });

  it("validates a cut, finds both fonts on disk and loads every export at render time", () => {
    const page = join(APP, ".next", "server", "app", "index.html");
    expect(existsSync(page), build.output).toBe(true);
    const html = readFileSync(page, "utf8");
    expect(readElement(html, "problems")).toBe("0");
    expect(readElement(html, "fonts")).toBe("true,true");
    expect(readElement(html, "exports")).toBe("loaded");
  });
});
