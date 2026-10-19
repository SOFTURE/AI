// The jobs version init reads: the installed one, else the lowest of the app's range.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readAppFacts } from "./app-facts.js";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "softure-deploy-app-facts-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function readJobsVersion(range: string | undefined, installed?: string): string | null | undefined {
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "shop", dependencies: range === undefined ? {} : { "@softure-ai/jobs": range } }));
  if (installed !== undefined) {
    mkdirSync(join(dir, "node_modules/@softure-ai/jobs"), { recursive: true });
    writeFileSync(join(dir, "node_modules/@softure-ai/jobs/package.json"), JSON.stringify({ version: installed }));
  }
  const result = readAppFacts(dir);
  if (!result.ok) throw new Error(result.problem);
  return result.facts.jobsVersion;
}

describe("readAppFacts jobsVersion", () => {
  it("reads the lowest version of the range when jobs is not installed", () => {
    expect(readJobsVersion("^0.1.3")).toBe("0.1.3");
    expect(readJobsVersion(">=0.1.3 <0.2")).toBe("0.1.3");
    expect(readJobsVersion("~0.2.0-beta.1")).toBe("0.2.0");
  });

  it("prefers the installed version", () => {
    expect(readJobsVersion("^0.1.2", "0.1.4")).toBe("0.1.4");
  });

  it("is null without jobs, for a range without a version, and stays fast on a long digit run", () => {
    expect(readJobsVersion(undefined)).toBeNull();
    expect(readJobsVersion("*")).toBeNull();
    expect(readJobsVersion("latest")).toBeNull();
    expect(readJobsVersion(`${"0".repeat(100_000)}.`)).toBeNull();
  });
});
