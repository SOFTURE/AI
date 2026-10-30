import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { findFootage, findMissingFootageFiles, loadMarketingConfig, type MarketingConfig } from "../src/config/config.js";

const COLORS = {
  background: "#0c0c0d",
  foreground: "#f2f3f5",
  muted: "#a3a6ad",
  accent: "#cff26b",
  cta: "#2dd4bf",
  onCta: "#0c0c0d",
  captionBackground: "#ecf1f7",
  captionText: "#0c0c0d",
  captionHighlight: "#059669",
};

function makeConfig(footage: Record<string, unknown>[] = [{ id: "street", title: "Street", clips: [{ id: "talk", source: "clips/talk.mov" }] }]) {
  return {
    brand: { name: "Acme", locale: "pl-PL", timezone: "Europe/Warsaw", colors: { ...COLORS } },
    app: { baseUrl: "http://localhost:3000", port: 3100, startCommand: ["npm", "start"], device: { viewport: [390, 844], scale: 3 } },
    voice: { voiceId: "voice-1", language: "pl" },
    videos: [],
    footage,
  };
}

describe("footage films in marketing.json", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "marketing-footage-"));
    mkdirSync(join(dir, "clips"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  function load(config: unknown): MarketingConfig {
    const file = join(dir, "marketing.json");
    writeFileSync(file, JSON.stringify(config));
    const result = loadMarketingConfig(file);
    if (!result.ok) throw new Error(result.error);
    return result.config;
  }

  function loadError(config: unknown): string {
    const file = join(dir, "marketing.json");
    writeFileSync(file, JSON.stringify(config));
    const result = loadMarketingConfig(file);
    if (result.ok) throw new Error("expected the config to be refused");
    return result.error;
  }

  it("fills the defaults: the voice's language, its fillers, a 9:16 talk clip fitted automatically, no music", () => {
    const film = findFootage(load(makeConfig()), "street");
    expect(film).toEqual({
      index: 0,
      id: "street",
      title: "Street",
      format: "9:16",
      language: "pl",
      layout: {},
      clips: [{ id: "talk", source: join(dir, "clips", "talk.mov"), role: "talk", fit: "auto", trim: { start: 0, end: null }, script: null }],
      isolateVoice: false,
      cut: { fillers: ["y", "e", "yhm", "yh", "ym", "em", "hm", "mhm", "eh", "uh"], pauseSeconds: 0.6, padSeconds: 0.12, maxSeconds: null },
      transitions: { jump: "cut", clip: "cut" },
      music: { source: { kind: "none" }, volume: 0.35, duckedVolume: 0.1 },
      captions: true,
      captionStyle: "phrase",
      edit: { zoomPercent: 108, fadeFrames: 10, kenBurnsPercent: 0, isEndCardWhoosh: false },
      endCard: null,
      loudness: { target: -14, truePeak: -1 },
      cover: {},
      post: null,
    });
  });

  it("turns the loudness pass and the cover off with false, and keeps a cover time and a loudness target", () => {
    const off = findFootage(load(makeConfig([{ id: "a", title: "A", clips: [{ id: "c", source: "c.mov" }], loudness: false, cover: false }])), "a");
    expect([off?.loudness, off?.cover]).toEqual([null, null]);
    const set = findFootage(load(makeConfig([{ id: "a", title: "A", clips: [{ id: "c", source: "c.mov" }], loudness: { target: -16 }, cover: { at: 2.5 } }])), "a");
    expect([set?.loudness, set?.cover]).toEqual([{ target: -16, truePeak: -1 }, { at: 2.5 }]);
  });

  it("keeps a URL clip as it is and resolves a music file", () => {
    const film = findFootage(
      load(makeConfig([{ id: "street", title: "Street", language: "en", clips: [{ id: "talk", source: "https://example.com/talk.mov", trim: { start: 1, end: 5 } }], music: { file: "music/bed.mp3", volume: 0.5 } }])),
      "street",
    );
    expect(film?.clips[0]?.source).toBe("https://example.com/talk.mov");
    expect(film?.clips[0]?.trim).toEqual({ start: 1, end: 5 });
    expect(film?.cut.fillers).toContain("um");
    expect(film?.music).toEqual({ source: { kind: "file", path: join(dir, "music", "bed.mp3") }, volume: 0.5, duckedVolume: 0.1 });
  });

  it("reads a music prompt and Video to Music with its tags", () => {
    const prompt = findFootage(load(makeConfig([{ id: "a", title: "A", clips: [{ id: "c", source: "c.mov" }], music: { prompt: "calm piano" } }])), "a");
    expect(prompt?.music.source).toEqual({ kind: "prompt", prompt: "calm piano" });
    const video = findFootage(load(makeConfig([{ id: "a", title: "A", clips: [{ id: "c", source: "c.mov" }], music: { fromVideo: { tags: ["upbeat"] } } }])), "a");
    expect(video?.music.source).toEqual({ kind: "video", description: "", tags: ["upbeat"] });
  });

  it("gives a footage film its post copy without the persona disclosure", () => {
    const config = {
      ...makeConfig(),
      social: { linkTemplate: "https://example.com/?z={code}", platforms: { tiktok: { code: "tt" } }, posts: [{ video: "street", caption: "Filmed on a phone." }], disclosure: "{persona} is an example." },
    };
    expect(findFootage(load(config), "street")?.post).toEqual({ caption: "Filmed on a phone.", disclosure: null, hashtags: [], channels: [{ platform: "tiktok", code: "tt", linkInBio: true }] });
  });

  it.each([
    [makeConfig([]), "  videos: needs at least one video, here or in footage"],
    [makeConfig([{ id: "a", title: "A", clips: [] }]), "  footage[0].clips: a footage film needs at least one clip"],
    [makeConfig([{ id: "a", title: "A", clips: [{ id: "c", source: "c.mov" }, { id: "c", source: "d.mov" }] }]), '  footage[0].clips[1].id: "c" appears twice'],
    [makeConfig([{ id: "a", title: "A", clips: [{ id: "c", source: "c.mov", trim: { start: 4, end: 2 } }] }]), "  footage[0].clips[0].trim.end: must be after trim.start"],
    [makeConfig([{ id: "a", title: "A", clips: [{ id: "c", source: "ftp://host/c.mov" }] }]), "  footage[0].clips[0].source: a URL must start with https:// or http://"],
    [makeConfig([{ id: "a", title: "A", clips: [{ id: "c", source: "c.mov" }], music: { file: "a.mp3", prompt: "b" } }]), "  footage[0].music: needs exactly one of file, prompt or fromVideo"],
    [makeConfig([{ id: "a", title: "A", clips: [{ id: "c", source: "c.mov", role: "vlog" }] }]), "  footage[0].clips[0].role:"],
    [makeConfig([{ id: "a", title: "A", clips: [{ id: "c", source: "c.mov" }], loudness: { target: 0 } }]), "  footage[0].loudness"],
  ])("refuses a broken footage entry (%#)", (config, message) => {
    expect(loadError(config)).toContain(message);
  });

  it("refuses two footage films with one id, and a footage id that a video has", () => {
    const film = { id: "street", title: "Street", clips: [{ id: "talk", source: "clips/talk.mov" }] };
    expect(loadError(makeConfig([film, film]))).toContain('  footage[1].id: "street" appears twice');
    const video = {
      id: "street",
      title: "Screen",
      path: "/",
      persona: { name: "Ola", age: 30, tagline: "counts" },
      beats: [
        { id: "hook", text: "One." },
        { id: "scene", text: "Two." },
        { id: "cta", text: "Three." },
      ],
      hook: { still: "s", shots: [{ mark: "m", scale: 1 }] },
      screenGuard: ["One"],
      endCard: { headline: "H", url: "example.com" },
      sceneModule: "scene.ts",
    };
    expect(loadError({ ...makeConfig([film]), videos: [video] })).toContain('  footage[0].id: "street" is also a video\'s id; both would write street/');
  });

  it("finds a missing local clip and music file by path, never a URL", () => {
    const config = load(makeConfig([{ id: "a", title: "A", clips: [{ id: "c", source: "clips/c.mov" }, { id: "u", source: "https://example.com/u.mov" }], music: { file: "bed.mp3" } }]));
    const film = findFootage(config, "a");
    if (film === null) throw new Error("no film");
    expect(findMissingFootageFiles(config, film, false).map((issue) => issue.path.join("."))).toEqual(["footage.0.clips.0.source", "footage.0.music.file"]);
    writeFileSync(join(dir, "clips", "c.mov"), "");
    writeFileSync(join(dir, "bed.mp3"), "");
    expect(findMissingFootageFiles(config, film, true)).toEqual([]);
  });
});
