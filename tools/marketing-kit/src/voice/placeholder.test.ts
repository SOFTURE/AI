import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { getPlaceholderKey, getPlaceholderSeconds, isPlaceholderKey, makePlaceholderWords, writePlaceholderVoiceover } from "./placeholder.js";

const PACE = { wordsPerSecond: 2.5, sentencePauseSeconds: 0.5 };
const hasFfmpeg = spawnSync("ffmpeg", ["-version"], { stdio: "ignore" }).status === 0;

describe("placeholder voiceover", () => {
  it("paces every word and pauses between sentences only", () => {
    expect(makePlaceholderWords([{ text: "Two words." }, { text: " One " }], PACE)).toEqual([
      { text: "Two", start: 0.1, end: 0.45 },
      { text: "words.", start: 0.5, end: 0.85 },
      { text: "One", start: 1.4, end: 1.75 },
    ]);
  });

  it("follows the configured pace", () => {
    const words = makePlaceholderWords([{ text: "a b" }], { wordsPerSecond: 1, sentencePauseSeconds: 0 });
    expect(words).toEqual([
      { text: "a", start: 0.1, end: 1.05 },
      { text: "b", start: 1.1, end: 2.05 },
    ]);
  });

  it("lasts half a second past the last word, and nothing for an empty script", () => {
    expect(getPlaceholderSeconds([{ text: "a", start: 0.1, end: 0.45 }])).toBe(0.95);
    expect(getPlaceholderSeconds([])).toBe(0.5);
  });

  it("marks its key, so a recording made on it is told apart", () => {
    expect(getPlaceholderKey("e5df9dc084ca3d58")).toBe("placeholder-e5df9dc084ca3d58");
    expect(isPlaceholderKey("placeholder-e5df9dc084ca3d58")).toBe(true);
    expect(isPlaceholderKey("e5df9dc084ca3d58")).toBe(false);
    expect(isPlaceholderKey(undefined)).toBe(false);
  });

  it.runIf(hasFfmpeg)("writes a real MP3 as long as the words and their JSON", () => {
    const dir = mkdtempSync(join(tmpdir(), "marketing-kit-placeholder-"));
    try {
      const voiceover = writePlaceholderVoiceover({ dir: join(dir, "placeholder"), sentences: [{ text: "Count your date." }], pace: PACE });
      expect(voiceover.audio).toBe(join(dir, "placeholder", "voiceover.mp3"));
      expect(JSON.parse(readFileSync(join(dir, "placeholder", "voiceover.json"), "utf8"))).toEqual(voiceover.words);
      const probe = spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration:stream=codec_name", "-of", "default=nw=1", voiceover.audio], { encoding: "utf8" });
      expect(probe.stdout).toContain("codec_name=mp3");
      const duration = Number(/duration=([\d.]+)/.exec(probe.stdout)?.[1]);
      expect(duration).toBeGreaterThan(1.6);
      expect(duration).toBeLessThan(1.8);
      expect(existsSync(join(dir, "voiceover"))).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
