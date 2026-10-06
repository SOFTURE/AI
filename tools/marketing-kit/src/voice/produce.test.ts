import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { getVoiceoverPaths } from "./cache.js";
import { createFakeTtsProvider } from "./fake.js";
import { produceVoiceover } from "./produce.js";
import type { TtsInput, TtsProvider } from "./provider.js";

const input: TtsInput = { text: "Anna has a cat.", voiceId: "v", model: "m", language: "en" };

let root: string;
let cacheDir: string;
let lines: string[];
const log = (line: string) => lines.push(line);

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "voiceover-"));
  cacheDir = join(root, "cache");
  lines = [];
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("produceVoiceover", () => {
  it("in a dry run prints the estimate, calls no provider and writes nothing", async () => {
    const provider = createFakeTtsProvider();
    const result = await produceVoiceover({ cacheDir, input, provider, isCommit: false, log });
    expect(result).toEqual({
      ok: true,
      value: { kind: "dry-run", key: getVoiceoverPaths(cacheDir, input).key, estimate: { characters: 15, maxCost: 0, unit: "fake credits" } },
    });
    expect(provider.calls).toHaveLength(0);
    expect(lines[0]).toBe("voiceover estimate (fake): 15 characters, at most 0 fake credits.");
    expect(lines[1]).toMatch(/DRY RUN .*--commit/);
    expect(() => readdirSync(cacheDir)).toThrow();
  });

  it("with --commit prints the estimate before the provider is called, then saves FIRE's file format", async () => {
    const fake = createFakeTtsProvider();
    const provider: TtsProvider = {
      id: fake.id,
      estimate: (value) => fake.estimate(value),
      synthesize: (value) => {
        lines.push("synthesize called");
        return fake.synthesize(value);
      },
    };
    const result = await produceVoiceover({ cacheDir, input, provider, isCommit: true, log });
    expect(lines.slice(0, 2)).toEqual(["voiceover estimate (fake): 15 characters, at most 0 fake credits.", "synthesize called"]);
    expect(result.ok && result.value.kind).toBe("recorded");
    const paths = getVoiceoverPaths(cacheDir, input);
    expect(readFileSync(paths.audio, "utf8")).toBe("fake audio: Anna has a cat.");
    expect(readFileSync(paths.words, "utf8")).toBe(
      '[\n {\n  "text": "Anna",\n  "start": 0,\n  "end": 0.4\n },\n {\n  "text": "has",\n  "start": 0.44,\n  "end": 0.84\n },\n' +
        ' {\n  "text": "a",\n  "start": 0.88,\n  "end": 1.28\n },\n {\n  "text": "cat.",\n  "start": 1.32,\n  "end": 1.72\n }\n]\n',
    );
  });

  it("logs the charge the provider reported next to the estimate and returns it", async () => {
    const fake = createFakeTtsProvider();
    const provider: TtsProvider = {
      id: "metered",
      estimate: () => ({ characters: 15, maxCost: 15, unit: "credits" }),
      synthesize: async (value) => {
        const recording = await fake.synthesize(value);
        return recording.ok ? { ok: true, value: { ...recording.value, charged: 6.3 } } : recording;
      },
    };
    const result = await produceVoiceover({ cacheDir, input, provider, isCommit: true, log });
    expect(result.ok && result.value.kind === "recorded" ? result.value.charged : "not recorded").toBe(6.3);
    expect(lines[1]).toBe("voiceover: metered charged 6.3 credits for 15 characters (the estimate was at most 15).");
  });

  it("says so when the provider does not report the charge", async () => {
    const fake = createFakeTtsProvider();
    const provider: TtsProvider = {
      id: "silent",
      estimate: () => ({ characters: 15, maxCost: 15, unit: "credits" }),
      synthesize: async (value) => {
        const recording = await fake.synthesize(value);
        return recording.ok ? { ok: true, value: { audio: recording.value.audio, words: recording.value.words } } : recording;
      },
    };
    const result = await produceVoiceover({ cacheDir, input, provider, isCommit: true, log });
    expect(result.ok && result.value.kind === "recorded" ? result.value.charged : "not recorded").toBeNull();
    expect(lines[1]).toBe("voiceover: silent did not report the charge; the estimate was at most 15 credits.");
  });

  it("serves a second run from the cache without calling the provider", async () => {
    const provider = createFakeTtsProvider();
    await produceVoiceover({ cacheDir, input, provider, isCommit: true, log });
    lines = [];
    const second = await produceVoiceover({ cacheDir, input, provider, isCommit: true, log });
    expect(second.ok && second.value.kind).toBe("cached");
    expect(provider.calls).toHaveLength(1);
    expect(lines).toEqual([`voiceover: from the cache ${getVoiceoverPaths(cacheDir, input).key}, nothing spent.`]);
  });

  it("returns the provider's error and writes nothing", async () => {
    const provider = createFakeTtsProvider({ failWith: "ElevenLabs answered 401 for voice v: bad key" });
    const result = await produceVoiceover({ cacheDir, input, provider, isCommit: true, log });
    expect(result).toEqual({ ok: false, error: "ElevenLabs answered 401 for voice v: bad key" });
    expect(() => readdirSync(cacheDir)).toThrow();
  });

  it("names a broken cached words file instead of recording again", async () => {
    const paths = getVoiceoverPaths(cacheDir, input);
    mkdirSync(cacheDir, { recursive: true });
    writeFileSync(paths.audio, "mp3");
    writeFileSync(paths.words, "{ not json");
    const provider = createFakeTtsProvider();
    const result = await produceVoiceover({ cacheDir, input, provider, isCommit: true, log });
    expect(result.ok ? "" : result.error).toMatch(new RegExp(`^cannot read ${paths.words.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
    expect(provider.calls).toHaveLength(0);
  });

  it("finds a FIRE_TRACKER recording under its original key for Polish, so it costs nothing", async () => {
    // FIRE's key for this input is pinned in voiceover.test.ts; a file named after it is a FIRE cache entry.
    const fire: TtsInput = {
      text: "Forty-nine years. That is when Anna stops working.",
      voiceId: "P9yx385KN0FOmLll8Lkx",
      model: "eleven_multilingual_v2",
      language: "pl",
    };
    mkdirSync(cacheDir, { recursive: true });
    writeFileSync(join(cacheDir, "619a27159288f1e1.mp3"), "mp3");
    writeFileSync(join(cacheDir, "619a27159288f1e1.json"), JSON.stringify([{ text: "Forty-nine", start: 0, end: 0.5 }]));
    const provider = createFakeTtsProvider();
    const result = await produceVoiceover({ cacheDir, input: fire, provider, isCommit: true, log });
    expect(result.ok && result.value.kind).toBe("cached");
    expect(provider.calls).toHaveLength(0);
  });
});

describe("produceVoiceover with a video id", () => {
  const videoId = "anna-calculator";
  /** A recording as 0.1.5 and earlier saved it: `<key>.mp3` and `<key>.json` in the cache root. */
  function writeFlatRecording(key: string): void {
    mkdirSync(cacheDir, { recursive: true });
    writeFileSync(join(cacheDir, `${key}.mp3`), "paid audio");
    writeFileSync(join(cacheDir, `${key}.json`), '[{"text":"Anna","start":0,"end":0.4}]\n');
  }

  it("finds a flat recording of an earlier version by its real file name and calls no provider", async () => {
    // Oracle outside the code: sha256 of {"text":"Anna has a cat.","voice":"v","model":"m","lang":"en"}, first 16 hex.
    const key = "d6944f24f8cf2a5f";
    expect(getVoiceoverPaths(cacheDir, input).key).toBe(key);
    writeFlatRecording(key);
    const provider = createFakeTtsProvider();
    const result = await produceVoiceover({ cacheDir, input, videoId, provider, isCommit: true, log });
    expect(result.ok && result.value.kind === "cached" && result.value.voiceover.audio).toBe(join(cacheDir, `${key}.mp3`));
    expect(provider.calls).toHaveLength(0);
    expect(lines[1]).toBe(
      `voiceover: ${key}.mp3 and .json sit in the cache root (the layout before 0.1.6); move them into ${join(cacheDir, videoId)}/ to keep them with their film.`,
    );
  });

  it("records a new voiceover into the video's own folder", async () => {
    const provider = createFakeTtsProvider();
    await produceVoiceover({ cacheDir, input, videoId, provider, isCommit: true, log });
    const { key } = getVoiceoverPaths(cacheDir, input);
    expect(readdirSync(join(cacheDir, videoId)).sort()).toEqual([`${key}.json`, `${key}.mp3`]);
    expect(readdirSync(cacheDir)).toEqual([videoId]);
  });

  it("prefers the video's folder over a flat file with the same key", () => {
    const { key } = getVoiceoverPaths(cacheDir, input);
    writeFlatRecording(key);
    expect(getVoiceoverPaths(cacheDir, input, videoId).layout).toBe("flat");
    mkdirSync(join(cacheDir, videoId));
    writeFileSync(join(cacheDir, videoId, `${key}.mp3`), "moved");
    writeFileSync(join(cacheDir, videoId, `${key}.json`), "[]\n");
    expect(getVoiceoverPaths(cacheDir, input, videoId)).toEqual({
      key,
      audio: join(cacheDir, videoId, `${key}.mp3`),
      words: join(cacheDir, videoId, `${key}.json`),
      layout: "video",
    });
  });

  it("lists the film's recordings the current script no longer uses, not the live one", async () => {
    const provider = createFakeTtsProvider();
    await produceVoiceover({ cacheDir, input: { ...input, text: "An older script." }, videoId, provider, isCommit: true, log });
    await produceVoiceover({ cacheDir, input, videoId, provider, isCommit: true, log });
    const old = getVoiceoverPaths(cacheDir, { ...input, text: "An older script." }).key;
    lines = [];
    await produceVoiceover({ cacheDir, input, videoId, provider, isCommit: false, log });
    expect(lines[0]).toBe(`voiceover: ${join(cacheDir, videoId)} also holds ${old}.mp3, which the current script does not use; delete them once no film needs them.`);
    expect(lines[1]).toMatch(/from the cache/);
  });

  it("keeps the flat layout without a video id and uses the video's folder when nothing is cached", () => {
    expect(getVoiceoverPaths(cacheDir, input).layout).toBe("flat");
    expect(getVoiceoverPaths(cacheDir, input, videoId).layout).toBe("video");
  });
});
