import { spawn, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

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

/** `runShots` without blocking the event loop, so a server in this process can answer the CLI's browser. */
function runShotsAsync(config: string, ...args: string[]): Promise<{ status: number | null; stdout: string; stderr: string }> {
  return new Promise((done) => {
    const child = spawn(TSX, [MAIN, "shots", ...args, `--config=${config}`]);
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => (stdout += chunk.toString()));
    child.stderr.on("data", (chunk: Buffer) => (stderr += chunk.toString()));
    child.on("close", (status) => done({ status, stdout, stderr }));
  });
}

/** A one-page server on a free port, standing in for a page outside the app. */
async function serveOnePage(html: string): Promise<{ url: string; close: () => Promise<void> }> {
  const server = createServer((_request, response) => response.writeHead(200, { "Content-Type": "text/html" }).end(html));
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  return {
    url: `http://127.0.0.1:${(server.address() as AddressInfo).port}/`,
    close: () => new Promise((done) => server.close(() => done())),
  };
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

  /** A copy of the fixture's config with a signIn block and its screenshot changed, written next to it. */
  function writeConfig(name: string, signIn: Record<string, unknown>, entry: Record<string, unknown>): string {
    const file = join(target, name);
    const data = JSON.parse(readFileSync(config, "utf8")) as { screenshots: Record<string, unknown>[] };
    writeFileSync(file, JSON.stringify({ ...data, signIn, screenshots: data.screenshots.map((shot) => ({ ...shot, ...entry })) }));
    return file;
  }

  const signInSteps = [{ do: "fill", target: { label: "Email" }, value: "{env:SHOTS_TEST_EMAIL}" }];

  it("refuses an unset variable before the app starts or the account is prepared", () => {
    const file = writeConfig("unset.json", { prepare: ["node", "-e", "process.exit(9)"], path: "/login", steps: signInSteps, expect: "Signed in" }, { signedIn: true });
    const result = spawnSync(TSX, [MAIN, "shots", `--config=${file}`], { encoding: "utf8", env: { ...process.env, SHOTS_TEST_EMAIL: "" } });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("✗ {env:SHOTS_TEST_EMAIL} is not set in the environment; marketing.json reads it for the screenshots.");
    expect(result.stdout).not.toContain("server:");
    expect(result.stdout).not.toContain("prepare:");
  });

  it("refuses a data key the preparation did not print, naming the entry and the keys it printed", async () => {
    const prepare = ["node", "-e", 'console.log("seed" + "ing"); console.log(JSON.stringify({ email: "demo@example.com" }))'];
    const file = writeConfig("missing-key.json", { prepare, path: "/login", steps: signInSteps, expect: "Signed in" }, { expect: "{data:total}" });
    const result = await runShotsAsync(file);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('✗ screenshot "calculator" expect: {data:total} is not in what signIn.prepare printed (keys: email).');
    expect(result.stdout).not.toContain('"email":"demo@example.com"');
    expect(result.stdout).not.toContain("seeding");
  }, 60_000);

  it.runIf(hasChromium)("gates the screenshot on a phrase and a path the preparation printed", async () => {
    // The path too comes from the data, so the CLI must find the app answering on a page without a placeholder.
    const prepare = ["node", "-e", 'console.log(JSON.stringify({ question: "When can you stop working?", page: "index.html" }))'];
    const file = writeConfig("data-phrase.json", { prepare, path: "/login", steps: signInSteps, expect: "Signed in" }, { path: "/{data:page}", expect: "{data:question}" });
    const result = await runShotsAsync(file);
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("prepare: node -e");
    expect(existsSync(join(target, "out", "screenshots", "calculator.png"))).toBe(true);
  }, 60_000);

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

  it.runIf(hasChromium)("takes an ad-hoc page into --out behind the gates, without a config entry", async () => {
    const server = await serveOnePage("<main><h1>A competitor page</h1></main>");
    try {
      const out = join(target, "adhoc", "competitor.png");
      const result = await runShotsAsync(config, `--page=${server.url}`, `--out=${out}`, "--expect=A competitor page", "--width=800", "--height=600", "--minbytes=0");
      expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
      expect(result.stdout).toContain(`✓ ${out} (`);
      expect(result.stdout).not.toContain("server:");
      expect(readFileSync(out).readUInt32BE(16)).toBe(800);
      const refused = await runShotsAsync(config, `--page=${server.url}`, `--out=${out}`, "--expect=Not on the page", "--minbytes=0");
      expect(refused.status).toBe(1);
      expect(refused.stderr).toContain(`✗ competitor: ${server.url} does not show "Not on the page"`);
      expect(existsSync(out)).toBe(false);
    } finally {
      await server.close();
    }
  });
});
