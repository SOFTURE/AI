import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { hasChromium } from "./chromium.js";

/**
 * `softure-marketing shots` on a copy of the fixture project: the CLI starts the fixture app through
 * `app.startCommand` (port 3198, the same as the opt-in render test; if both run at once, the second
 * reuses the first's server, which serves the same files) and writes the configured screenshot.
 */
const PACKAGE_DIR = join(import.meta.dirname, "..");
const FIXTURE = join(PACKAGE_DIR, "examples", "fixture");
const TSX = join(PACKAGE_DIR, "..", "..", "node_modules", ".bin", "tsx");
const MAIN = join(PACKAGE_DIR, "src", "cli", "main.ts");

function runShots(config: string, ...args: string[]) {
  return spawnSync(TSX, [MAIN, "shots", ...args, `--config=${config}`], { encoding: "utf8" });
}

describe("softure-marketing shots", () => {
  const target = mkdtempSync(join(tmpdir(), "marketing-kit-shots-cli-"));
  cpSync(FIXTURE, target, { recursive: true, filter: (source) => !/[/\\](build|out|voiceover|assets)$/.test(source) });
  const config = join(target, "marketing.json");
  afterAll(() => rmSync(target, { recursive: true, force: true }));

  it("refuses a screenshot id the config does not have, naming the known ones", () => {
    const result = runShots(config, "pricing");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(`✗ no screenshot "pricing" in ${config}; known: calculator.`);
  });

  it("refuses a missing storage state before the browser starts, naming the entry and the file", () => {
    const signedIn = join(target, "signed-in.json");
    const data = JSON.parse(readFileSync(config, "utf8")) as { screenshots: Record<string, unknown>[] };
    data.screenshots = data.screenshots.map((entry) => ({ ...entry, storageState: "auth/state.json" }));
    writeFileSync(signedIn, JSON.stringify(data));
    const result = runShots(signedIn);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(`✗ screenshot "calculator": the storage state ${join(target, "auth", "state.json")} does not exist;`);
    expect(result.stdout).not.toContain("server:");
  });

  it.runIf(hasChromium)("writes the fixture's screenshot", () => {
    const result = runShots(config);
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    const file = join(target, "out", "screenshots", "calculator.png");
    expect(result.stdout).toContain(`✓ ${file} (`);
    expect(readFileSync(file).subarray(1, 4).toString("latin1")).toBe("PNG");
  });

  it.runIf(hasChromium)("writes a light and a dark file at the entry's device scale", () => {
    const pair = join(target, "pair.json");
    const data = JSON.parse(readFileSync(config, "utf8")) as { screenshots: Record<string, unknown>[] };
    data.screenshots = data.screenshots.map((entry) => ({ ...entry, scale: 2, colorSchemes: ["light", "dark"] }));
    writeFileSync(pair, JSON.stringify(data));
    const result = runShots(pair, "calculator");
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    for (const scheme of ["light", "dark"]) {
      const file = join(target, "out", "screenshots", `calculator-${scheme}.png`);
      expect(result.stdout).toContain(`✓ ${file} (`);
      expect(readFileSync(file).readUInt32BE(16)).toBe(2560);
    }
  });

  it.runIf(hasChromium)("exits with 1 and names the gate when a screenshot fails", () => {
    const failing = join(target, "failing.json");
    const data = JSON.parse(readFileSync(config, "utf8")) as { screenshots: { expect: string }[] };
    data.screenshots = data.screenshots.map((entry) => ({ ...entry, expect: "A phrase the page never shows" }));
    writeFileSync(failing, JSON.stringify(data));
    const result = runShots(failing, "calculator");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('✗ calculator: http://localhost:3198/ does not show "A phrase the page never shows"');
    expect(result.stderr).toContain("✗ 1 of 1 screenshots failed their gates; see above.");
    expect(existsSync(join(target, "out", "screenshots", "calculator.png"))).toBe(false);
  });
});
