// Issue #549: the blog CLI bundled into one ESM file, on real Node (not Vite), for an app without the
// optional @softure-ai/jobs peer. The build refuses every jobs specifier, so the bundle holds no path to it.
import { execFile } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { build, type Plugin } from "esbuild";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const runFile = promisify(execFile);
const REPO_ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const ENTRY = fileURLToPath(new URL("./fixtures/cli-bundle/entry.ts", import.meta.url));

/** The app has not installed @softure-ai/jobs: resolving it fails the build. */
const withoutJobs: Plugin = {
  name: "without-jobs",
  setup(pluginBuild) {
    pluginBuild.onResolve({ filter: /^@softure-ai\/jobs(\/|$)/ }, (args) => ({ errors: [{ text: `${args.path} is not installed` }] }));
  },
};

// Inside the repository, so the external drivers resolve from its node_modules like in an image.
let bundleDir = "";

beforeAll(async () => {
  const cacheDir = join(REPO_ROOT, "node_modules/.cache");
  mkdirSync(cacheDir, { recursive: true });
  bundleDir = mkdtempSync(join(cacheDir, "softure-blog-cli-bundle-"));
  await build({
    entryPoints: { blog: ENTRY },
    outdir: bundleDir,
    outExtension: { ".js": ".mjs" },
    bundle: true,
    splitting: false,
    platform: "node",
    format: "esm",
    target: "node22",
    external: ["pg", "@electric-sql/pglite"],
    // The usual banner of an ESM bundle with CommonJS dependencies (yaml requires node built-ins).
    banner: { js: 'import { createRequire } from "node:module"; const require = createRequire(import.meta.url);' },
    // CI's test job has no dist/: read workspace packages from their sources, as Vitest does.
    conditions: ["@softure-ai/source"],
    plugins: [withoutJobs],
    logLevel: "silent",
  });
});

afterAll(() => {
  rmSync(bundleDir, { recursive: true, force: true });
});

describe("the blog CLI bundled without @softure-ai/jobs", () => {
  it("builds, and leaves the jobs entry to a runtime import", () => {
    const bundle = readFileSync(join(bundleDir, "blog.mjs"), "utf8");

    expect(bundle).not.toContain("@softure-ai/jobs");
  });

  it("starts on Node and prints the usage", async () => {
    const result = await runFile(process.execPath, [join(bundleDir, "blog.mjs")]).then(
      () => ({ code: 0, stderr: "" }),
      (error: { code?: number; stderr?: string }) => ({ code: error.code ?? -1, stderr: error.stderr ?? "" }),
    );

    expect(result.code).toBe(2);
    expect(result.stderr).toContain("Usage:");
  });
});
