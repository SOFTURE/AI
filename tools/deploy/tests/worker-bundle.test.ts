import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build } from "esbuild";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AppFacts } from "../src/init/app-facts.js";
import { planInitFiles } from "../src/init/generate.js";

const PACKAGE_DIR = join(import.meta.dirname, "..");
const WORKER_DOCKERFILE = "docker/worker.Dockerfile";

const FACTS: AppFacts = {
  packageName: "acme-app",
  hasDatabase: true,
  hasHealthRoute: true,
  hasPublicDir: true,
  nextConfigFile: "next.config.ts",
  isStandalone: true,
  hasJobs: true,
  jobsVersion: "0.1.6",
};

/** A worker that runs marketing-kit's footage blocks, the use case of the worker image (issues #948, #995). */
const FOOTAGE_WORKER_ENTRY = [
  'import { footageCacheKey, normalizeFootage } from "@softure-ai/marketing-kit";',
  "console.log(typeof footageCacheKey, typeof normalizeFootage);",
  "",
].join("\n");

type BundleFlags = { external: string[]; alias: Record<string, string>; banner: string };

function getWorkerDockerfile(): string {
  const files = planInitFiles({
    answers: {
      domain: "example.com",
      image: "ghcr.io/acme/app",
      name: "acme-app",
      paths: ["/"],
      www: false,
      env: [],
      tables: [],
      workerDockerfile: WORKER_DOCKERFILE,
    },
    facts: FACTS,
    cliVersion: "9.9.9",
  });
  const dockerfile = files.find((file) => file.path === WORKER_DOCKERFILE);
  if (!dockerfile) throw new Error(`planInitFiles planned no ${WORKER_DOCKERFILE}`);
  return dockerfile.text;
}

/** The flags of the generated esbuild command, so the test bundles exactly what the image build bundles. */
function getBundleFlags(dockerfile: string): BundleFlags {
  const external = [...dockerfile.matchAll(/--external:(\S+)/g)].map((match) => match[1] ?? "");
  const alias = Object.fromEntries(
    [...dockerfile.matchAll(/--alias:([^=\s]+)=(\S+)/g)].map((match) => [match[1] ?? "", match[2] ?? ""]),
  );
  const banner = /--banner:js="([^"]*)"/.exec(dockerfile)?.[1] ?? "";
  return { external, alias, banner };
}

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "softure-deploy-worker-bundle-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("the esbuild command of the generated worker Dockerfile (issue #995)", () => {
  it("keeps @softure-ai/marketing-kit external, so it loads from node_modules with its native and run-time dependencies", () => {
    expect(getBundleFlags(getWorkerDockerfile()).external).toContain("@softure-ai/marketing-kit");
  });

  it("bundles a worker that imports marketing-kit's footage blocks", async () => {
    const flags = getBundleFlags(getWorkerDockerfile());
    mkdirSync(join(dir, ".esbuild"));
    writeFileSync(join(dir, ".esbuild/empty.mjs"), "export {};\n");
    const alias = Object.fromEntries(Object.entries(flags.alias).map(([from, to]) => [from, join(dir, to)]));
    const outfile = join(dir, "worker.mjs");
    await build({
      stdin: { contents: FOOTAGE_WORKER_ENTRY, resolveDir: PACKAGE_DIR, loader: "ts", sourcefile: "scripts/worker.ts" },
      bundle: true,
      platform: "node",
      format: "esm",
      target: "node22",
      banner: { js: flags.banner },
      alias,
      conditions: ["@softure-ai/source"],
      external: flags.external,
      outfile,
      logLevel: "silent",
    });
    expect(execFileSync(process.execPath, ["--check", outfile], { encoding: "utf8", stdio: "pipe" })).toBe("");
  });
});
