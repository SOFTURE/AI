import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createFakeIsolationProvider, createFakeMusicProvider, createFakeSttProvider } from "./fake.js";
import { DEFAULT_TRANSITIONS, type FootageFilm } from "./film.js";
import { findCachedStep, getClipCacheKey, getDownloadPath, getEdlPath, getPromptMusicCache, getTranscriptCache, getVideoMusicCache } from "./paid.js";
import { toPaidAudio } from "./providers.js";

describe("findCachedStep", () => {
  let dir: string;
  const providers = { stt: createFakeSttProvider(), isolation: createFakeIsolationProvider(), music: createFakeMusicProvider() };

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "footage-paid-"));
    writeFileSync(join(dir, "talk.mov"), "bytes of talk");
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  function film(changes: Partial<FootageFilm> = {}): FootageFilm {
    return {
      id: "street",
      title: "Street",
      format: "9:16",
      language: "en",
      clips: [{ id: "talk", source: join(dir, "talk.mov"), role: "talk", fit: "auto", trim: { start: 0, end: null }, script: null }],
      isolateVoice: false,
      cut: { fillers: [], pauseSeconds: 0.6, padSeconds: 0.1, maxSeconds: null },
      transitions: DEFAULT_TRANSITIONS,
      music: { source: { kind: "prompt", prompt: "calm" }, volume: 0.35, duckedVolume: 0.1 },
      captions: true,
      endCard: null,
      ...changes,
    };
  }

  const options = () => ({ cacheDir: join(dir, "cache"), providers, buildDir: join(dir, "build") });

  async function cacheTranscript(entry: FootageFilm): Promise<void> {
    const clip = entry.clips[0];
    if (clip === undefined) throw new Error("no clip");
    const { path } = getTranscriptCache(entry, await getClipCacheKey(clip.source, clip), options());
    mkdirSync(join(path, ".."), { recursive: true });
    writeFileSync(path, "[]");
  }

  it("answers from the cache file the pipeline writes, without network or ffmpeg", async () => {
    expect(await findCachedStep(film(), "transcribe", "talk", options())).toBe(false);
    await cacheTranscript(film());
    expect(await findCachedStep(film(), "transcribe", "talk", options())).toBe(true);
    // Another language is another transcript.
    expect(await findCachedStep(film({ language: "pl" }), "transcribe", "talk", options())).toBe(false);
  });

  it("answers false for an unknown clip, a step the film skips and a URL clip not downloaded yet", async () => {
    await cacheTranscript(film());
    expect(await findCachedStep(film(), "transcribe", "gone", options())).toBe(false);
    expect(await findCachedStep(film(), "isolate", "talk", options())).toBe(false);
    const url = "https://cdn.example.com/talk.mov";
    const remote = film({ clips: [{ id: "talk", source: url, role: "talk", fit: "auto", trim: { start: 0, end: null }, script: null }] });
    expect(await findCachedStep(remote, "transcribe", "talk", options())).toBe(false);
    // Once downloaded into the build folder, the copy's bytes decide.
    const copy = getDownloadPath(url, join(dir, "build", "sources"));
    mkdirSync(join(copy, ".."), { recursive: true });
    writeFileSync(copy, "bytes of talk");
    expect(await findCachedStep(remote, "transcribe", "talk", options())).toBe(true);
  });

  it("knows free music needs nothing, prompt music by its prompt, and scored music only with a cut", async () => {
    expect(await findCachedStep(film({ music: { source: { kind: "none" }, volume: 0.3, duckedVolume: 0.1 } }), "music", "film", options())).toBe(true);
    expect(await findCachedStep(film(), "music", "film", options())).toBe(false);
    const prompt = getPromptMusicCache(film(), options()).path;
    mkdirSync(join(prompt, ".."), { recursive: true });
    writeFileSync(prompt, "music");
    expect(await findCachedStep(film(), "music", "film", options())).toBe(true);

    const scored = film({ music: { source: { kind: "video", description: "", tags: [] }, volume: 0.3, duckedVolume: 0.1 } });
    expect(await findCachedStep(scored, "music", "film", options())).toBe(false);
    // A version 1 file (no ids) and the same cut with ids share the key: music bought for it is not bought again.
    const file = { version: 1, film: "street", segments: [{ clip: "talk", start: 0, end: 2, transition: "cut", motion: "none" }] };
    mkdirSync(join(dir, "build"), { recursive: true });
    writeFileSync(getEdlPath(join(dir, "build"), false), JSON.stringify(file));
    const clip = scored.clips[0];
    if (clip === undefined) throw new Error("no clip");
    const edl = { version: 2 as const, film: "street", segments: [{ id: "s1", clip: "talk", start: 0, end: 2, transition: "cut" as const, motion: "none" as const }] };
    const { path } = getVideoMusicCache(scored, edl, { talk: await getClipCacheKey(clip.source, clip) }, options());
    writeFileSync(path, "music");
    expect(await findCachedStep(scored, "music", "film", options())).toBe(true);
  });
});

describe("toPaidAudio", () => {
  it("takes a provider's plain audio or its audio with a charge", () => {
    const audio = Buffer.from("mp3");
    expect(toPaidAudio(audio)).toEqual({ audio });
    expect(toPaidAudio({ audio, credits: 12 })).toEqual({ audio, credits: 12 });
  });
});
