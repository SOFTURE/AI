import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createFakeIsolationProvider, createFakeMusicProvider, createFakeSttProvider } from "./fake.js";
import { DEFAULT_TRANSITIONS, type FootageClip, type FootageFilm } from "./film.js";
import { cutFootage, getEdlPath, getMusicPaidStep, readEdlFile, readRenderPercent, transcribeFootage, type FootageRunOptions, type PreparedClip } from "./pipeline.js";
import type { FootageProbe } from "./probe.js";

const PROBE: FootageProbe = { duration: 6, width: 1080, height: 1920, rotation: 0, displayWidth: 1080, displayHeight: 1920, codec: "h264", pixelFormat: "yuv420p", colorTransfer: null, hdr: null, hasAudio: true };

describe("the footage pipeline without ffmpeg", () => {
  let dir: string;
  let lines: string[];

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "footage-pipeline-"));
    lines = [];
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  function clip(id: string, role: FootageClip["role"], script: string | null): PreparedClip {
    const source = join(dir, `${id}.mov`);
    writeFileSync(source, `bytes of ${id}`);
    return { clip: { id, source, role, fit: "auto", trim: { start: 0, end: null }, script }, source, probe: PROBE, file: join(dir, "build", "clips", `${id}.mp4`), duration: 6 };
  }

  function film(changes: Partial<FootageFilm> = {}): FootageFilm {
    return {
      id: "street",
      title: "Street",
      format: "9:16",
      language: "pl",
      clips: [],
      isolateVoice: true,
      cut: { fillers: ["y"], pauseSeconds: 0.6, padSeconds: 0.1, maxSeconds: null },
      transitions: DEFAULT_TRANSITIONS,
      music: { source: { kind: "prompt", prompt: "calm" }, volume: 0.35, duckedVolume: 0.1 },
      captions: true,
      endCard: { headline: "Try", url: "example.com", note: "" },
      ...changes,
    };
  }

  function options(changes: Partial<FootageRunOptions> = {}) {
    const providers = { stt: createFakeSttProvider(), isolation: createFakeIsolationProvider(), music: createFakeMusicProvider() };
    const run: FootageRunOptions = { buildDir: join(dir, "build"), cacheDir: join(dir, "cache"), providers, isCommit: false, isPlaceholder: false, log: (line) => lines.push(line), ...changes };
    return { run, providers };
  }

  it("lists every paid call with its length and calls no provider without --commit", async () => {
    const { run, providers } = options();
    const result = await transcribeFootage(film(), [clip("talk", "talk", null), clip("street", "broll", null)], run);
    expect(result).toEqual({
      ok: true,
      value: {
        kind: "dry-run",
        steps: [
          { kind: "isolate", item: "clip talk", provider: "fake", seconds: 6 },
          { kind: "transcribe", item: "clip talk", provider: "fake", seconds: 6 },
          { kind: "music", item: "film", provider: "fake", seconds: 15 },
        ],
      },
    });
    expect(providers.stt.calls).toHaveLength(0);
    expect(providers.isolation.calls).toHaveLength(0);
    expect(providers.music.calls).toHaveLength(0);
    expect(lines.at(-2)).toBe("footage estimate: 3 paid calls, 27.0 s of audio or music billed by the providers' per-minute rates.");
    expect(existsSync(join(dir, "cache"))).toBe(false);
  });

  it("rehearses on each clip's script, writing nothing into the paid cache", async () => {
    const { run, providers } = options({ isPlaceholder: true });
    const result = await transcribeFootage(film(), [clip("talk", "talk", "Raz dwa"), clip("street", "broll", "never read")], run);
    if (!result.ok || result.value.kind !== "ready") throw new Error("expected transcripts");
    expect(result.value.words.talk?.map((word) => word.text)).toEqual(["Raz", "dwa"]);
    expect(result.value.words.street).toEqual([]);
    expect(result.value.speech.talk).toBe(join(dir, "build", "clips", "talk.mp4"));
    expect(existsSync(join(dir, "build", "placeholder", "talk.transcript.json"))).toBe(true);
    expect(existsSync(join(dir, "cache"))).toBe(false);
    expect(providers.stt.calls).toHaveLength(0);
  });

  it("needs no paid music for a local file or none", () => {
    const { run } = options();
    expect(getMusicPaidStep(film({ music: { source: { kind: "none" }, volume: 0.3, duckedVolume: 0.1 } }), run, 10)).toBeNull();
    expect(getMusicPaidStep(film({ music: { source: { kind: "file", path: "/m.mp3" }, volume: 0.3, duckedVolume: 0.1 } }), run, 10)).toBeNull();
    expect(getMusicPaidStep(film({ music: { source: { kind: "video", description: "", tags: [] }, volume: 0.3, duckedVolume: 0.1 } }), run, 10)).toEqual({ kind: "music", item: "film", provider: "fake", seconds: 10 });
  });

  it("writes the cut as an EDL a person can edit, and reads the edited file back", () => {
    const clips = [clip("talk", "talk", null), clip("street", "broll", null)];
    const path = getEdlPath(join(dir, "build"), false);
    const edl = cutFootage(film(), clips, { talk: [{ text: "Hej", start: 1, end: 1.5 }] }, path);
    expect(edl.segments.map((segment) => segment.clip)).toEqual(["talk", "street"]);
    const edited = JSON.parse(readFileSync(path, "utf8")) as { segments: { transition: string }[] };
    (edited.segments[1] as { transition: string }).transition = "whoosh";
    writeFileSync(path, JSON.stringify(edited));
    const read = readEdlFile(film(), clips, path);
    expect(read.ok && read.value.segments[1]?.transition).toBe("whoosh");
    writeFileSync(path, JSON.stringify({ ...edited, segments: [{ id: "s1", clip: "gone", start: 0, end: 1, transition: "cut", motion: "none" }] }));
    expect(readEdlFile(film(), clips, path)).toEqual({ ok: false, error: `${path}: segments[0].clip: no clip "gone" in the film` });
    expect(getEdlPath("/b", true)).toBe("/b/edl.placeholder.json");
  });
});

describe("readRenderPercent", () => {
  it("reads the last percentage of a hyperframes line, and nothing from other lines", () => {
    expect(readRenderPercent("Capturing frames  42%")).toBe(42);
    expect(readRenderPercent("[3/4] encoding 12.5 % done, 87.5%")).toBe(87.5);
    expect(readRenderPercent("Rendered 90 frames")).toBeNull();
    expect(readRenderPercent("150%")).toBeNull();
  });
});
