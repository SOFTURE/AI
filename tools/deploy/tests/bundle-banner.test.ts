import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build } from "esbuild";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AppFacts } from "../src/init/app-facts.js";
import { planInitFiles } from "../src/init/generate.js";

const PACKAGE_DIR = join(import.meta.dirname, "..");

const FACTS: AppFacts = {
  packageName: "acme-app",
  hasDatabase: true,
  hasHealthRoute: true,
  hasPublicDir: true,
  nextConfigFile: "next.config.ts",
  isStandalone: true,
  hasJobs: true,
};

const WORKER_ENTRY = [
  'import { startObservability } from "@softure-ai/observability/node";',
  "console.log(typeof startObservability);",
  "",
].join("\n");

function getDockerfile(): string {
  const files = planInitFiles({
    answers: { domain: "example.com", image: "ghcr.io/acme/app", name: "acme-app", paths: ["/"], www: false, env: [], tables: [] },
    facts: FACTS,
    cliVersion: "9.9.9",
  });
  const dockerfile = files.find((file) => file.path === "Dockerfile");
  if (!dockerfile) throw new Error("planInitFiles planned no Dockerfile");
  return dockerfile.text;
}

function getBanners(dockerfile: string): string[] {
  return [...dockerfile.matchAll(/--banner:js="([^"]*)"/g)].map((match) => match[1] ?? "");
}

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "softure-deploy-banner-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("the esbuild banner of the generated Dockerfile", () => {
  it("is the same in the migrate, worker and ops commands", () => {
    const banners = getBanners(getDockerfile());
    expect(banners).toHaveLength(3);
    expect(new Set(banners).size).toBe(1);
  });

  it("loads in a bundle with @softure-ai/observability's own top-level createRequire import", async () => {
    const [banner] = getBanners(getDockerfile());
    const outfile = join(dir, "worker.mjs");
    await build({
      stdin: { contents: WORKER_ENTRY, resolveDir: PACKAGE_DIR, loader: "ts", sourcefile: "scripts/worker.ts" },
      bundle: true,
      platform: "node",
      format: "esm",
      target: "node22",
      banner: { js: banner ?? "" },
      conditions: ["@softure-ai/source"],
      external: ["pg", "@electric-sql/pglite", "drizzle-orm/pglite", "drizzle-orm/node-postgres"],
      outfile,
      logLevel: "silent",
    });
    expect(execFileSync(process.execPath, ["--check", outfile], { encoding: "utf8", stdio: "pipe" })).toBe("");
  });
});
