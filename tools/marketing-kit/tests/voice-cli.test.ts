import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, describe, expect, it } from "vitest";

/** `softure-marketing voice` with several films on a copy of the fixture project; no key, so nothing is ever paid. */
const PACKAGE_DIR = join(import.meta.dirname, "..");
const FIXTURE = join(PACKAGE_DIR, "examples", "fixture");
const TSX = join(PACKAGE_DIR, "..", "..", "node_modules", ".bin", "tsx");
const MAIN = join(PACKAGE_DIR, "src", "cli", "main.ts");

function runVoice(config: string, ...args: string[]) {
  const env = { ...process.env };
  delete env.ELEVENLABS_API_KEY;
  return spawnSync(TSX, [MAIN, "voice", ...args, `--config=${config}`], { encoding: "utf8", env });
}

describe("softure-marketing voice with several films", () => {
  const target = mkdtempSync(join(tmpdir(), "marketing-kit-voice-cli-"));
  cpSync(FIXTURE, target, { recursive: true, filter: (source) => !/[/\\](build|out|voiceover|assets)$/.test(source) });
  const config = join(target, "marketing.json");
  afterAll(() => rmSync(target, { recursive: true, force: true }));

  it("in a dry run prints each estimate and the batch's total, and writes nothing", () => {
    const result = runVoice(config, "fixture-tour", "fixture-desktop");
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("voiceovers estimated only (dry run): 2 (fixture-tour, fixture-desktop)");
    expect(result.stdout).toMatch(/^total: \d+ characters, at most \d+ ElevenLabs credits\.$/m);
    expect(existsSync(join(target, "voiceover"))).toBe(false);
  });

  it("with --commit stops at the first failure and names the films never sent", () => {
    const result = runVoice(config, "fixture-tour", "fixture-desktop", "--commit");
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("stopped at fixture-tour: no ELEVENLABS_API_KEY in the environment.");
    expect(result.stdout).toContain("not attempted: fixture-desktop.");
    expect(result.stderr).toContain("✗ the batch stopped at fixture-tour; 1 film was not sent. See above.");
  });

  it("checks every film before the first call", () => {
    const result = runVoice(config, "fixture-tour", "no-such-film", "--commit");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('no video "no-such-film"');
    expect(result.stdout).not.toContain("voiceover estimate");
  });
});
