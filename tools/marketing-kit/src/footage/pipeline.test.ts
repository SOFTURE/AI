import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { BrandColors } from "../config/colors.js";
import { createFakeIsolationProvider, createFakeMusicProvider, createFakeSttProvider } from "./fake.js";
import { DEFAULT_TRANSITIONS, type FootageClip, type FootageFilm } from "./film.js";
import { getClipCacheKey, getIsolatedCache } from "./paid.js";
import type { FootageCharge } from "./providers.js";
import { cutFootage, getEdlPath, getMusicPaidStep, prepareFootage, readEdlFile, readRenderPercent, renderFootage, transcribeFootage, type FootageRunOptions, type PreparedClip } from "./pipeline.js";
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

  async function seedIsolatedVoice(entry: FootageFilm, prepared: PreparedClip, run: FootageRunOptions): Promise<void> {
    const isolated = getIsolatedCache(entry, await getClipCacheKey(prepared.source, prepared.clip), run);
    if (isolated === null) throw new Error("the film isolates the voice");
    mkdirSync(join(isolated.path, ".."), { recursive: true });
    writeFileSync(isolated.path, "cleaned voice");
  }

  it("sends the film's key terms to speech to text and counts them on the charge", async () => {
    const charges: FootageCharge[] = [];
    const { run, providers } = options({ isCommit: true, onCharge: (charge) => charges.push(charge) });
    const named = film({ keyTerms: ["Zakopane", " Acme ", "Acme"] });
    const talk = clip("talk", "talk", null);
    await seedIsolatedVoice(named, talk, run);
    const result = await transcribeFootage(named, [talk], run);
    expect(result.ok && result.value.kind).toBe("ready");
    expect(providers.stt.calls.map((call) => call.keyTerms)).toEqual([["Acme", "Zakopane"]]);
    expect(charges).toEqual([expect.objectContaining({ step: "transcribe", item: "talk", keyTerms: 2 })]);
  });

  it("sends no key terms and counts none for a film without them", async () => {
    const charges: FootageCharge[] = [];
    const { run, providers } = options({ isCommit: true, onCharge: (charge) => charges.push(charge) });
    const talk = clip("talk", "talk", null);
    await seedIsolatedVoice(film(), talk, run);
    await transcribeFootage(film({ keyTerms: [] }), [talk], run);
    expect(providers.stt.calls).toHaveLength(1);
    expect("keyTerms" in (providers.stt.calls[0] ?? {})).toBe(false);
    expect("keyTerms" in (charges[0] ?? {})).toBe(false);
  });

  it("refuses key terms over Scribe's limits before any paid call", async () => {
    const { run, providers } = options({ isCommit: true });
    const result = await transcribeFootage(film({ keyTerms: ["x".repeat(51)] }), [clip("talk", "talk", null)], run);
    expect(result).toEqual({ ok: false, error: `footage film street: key term "${"x".repeat(51)}": 51 characters, at most 50.` });
    expect(providers.stt.calls).toHaveLength(0);
    expect(providers.isolation.calls).toHaveLength(0);
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

  it("ends a render on a full temp folder with a sentence, before the music is bought or any step runs", async () => {
    const { run, providers } = options({ isCommit: true });
    const clips = [clip("talk", "talk", null)];
    const edl = cutFootage(film(), clips, { talk: [{ text: "Hej", start: 1, end: 1.5 }] }, getEdlPath(run.buildDir, false));
    lines.length = 0;
    const tempDir = join(dir, "small-tmp");
    const result = await renderFootage(film(), clips, { kind: "ready", words: { talk: [{ text: "Hej", start: 1, end: 1.5 }] }, speech: { talk: join(dir, "talk.mp3") } }, edl, {
      ...run,
      brand: { name: "Brand", locale: "pl-PL", colors: {} as BrandColors, fonts: { heading: null, body: null }, logo: null },
      sfx: {},
      quality: "draft",
      output: join(dir, "out", "film.mp4"),
      tempDir,
      readFreeBytes: (folder) => (folder === tempDir ? 300 * 1024 ** 2 : 50 * 1024 ** 3),
    });
    expect(result).toEqual({
      ok: false,
      error: `not enough disk space to render: the temp folder ${tempDir} has 0.3 GiB free and a hyperframes render needs 1.0 GiB; hyperframes extracts the clips' frames there (hundreds of MB per minute of film): point TMPDIR (or renderFootage's tempDir) at a data volume, not a small tmpfs.`,
    });
    expect(providers.music.calls).toEqual([]);
    expect(lines).toEqual([]);
    expect(existsSync(join(run.buildDir, "assets"))).toBe(false);
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

const hasFfmpeg = spawnSync("ffprobe", ["-version"]).status === 0 && spawnSync("ffmpeg", ["-version"]).status === 0;

describe.runIf(hasFfmpeg)("prepareFootage with a local music file (issue #996)", () => {
  let dir: string;
  let lines: string[];

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "footage-music-"));
    lines = [];
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  function make(name: string, args: string[]): string {
    const file = join(dir, name);
    const result = spawnSync("ffmpeg", ["-v", "error", "-y", ...args, file], { encoding: "utf8" });
    if (result.status !== 0) throw new Error(`ffmpeg could not make ${name}: ${result.stderr}`);
    return file;
  }

  function filmWithMusic(path: string): FootageFilm {
    const source = make("talk.mp4", ["-f", "lavfi", "-i", "color=c=black:s=64x64:d=1", "-pix_fmt", "yuv420p"]);
    return {
      id: "street",
      title: "Street",
      format: "9:16",
      language: "en",
      clips: [{ id: "talk", source, role: "talk", fit: "auto", trim: { start: 0, end: null }, script: null }],
      isolateVoice: false,
      cut: { fillers: [], pauseSeconds: 0.6, padSeconds: 0.1, maxSeconds: null },
      transitions: DEFAULT_TRANSITIONS,
      music: { source: { kind: "file", path }, volume: 0.35, duckedVolume: 0.1 },
      captions: false,
      endCard: { headline: "Try", url: "example.com", note: "" },
    };
  }

  const run = () => ({ buildDir: join(dir, "build"), log: (line: string) => lines.push(line) });

  it("stops before normalizing when the music file has no audio", async () => {
    const music = make("bed.mp3", ["-f", "lavfi", "-i", "color=c=black:s=64x64:d=1", "-f", "mp4", "-pix_fmt", "yuv420p"]);
    expect(await prepareFootage(filmWithMusic(music), run())).toEqual({ ok: false, error: `music: ${music}: no audio stream` });
    expect(existsSync(join(dir, "build", "clips", "talk.mp4"))).toBe(false);
  });

  it("stops on a music file of a type the render does not take", async () => {
    const music = make("bed.mp4", ["-f", "lavfi", "-i", "sine=duration=1"]);
    const result = await prepareFootage(filmWithMusic(music), run());
    expect(result).toEqual({ ok: false, error: `music: ${music}: not a music file (accepted: .mp3, .m4a, .aac, .wav, .ogg, .oga, .opus, .flac)` });
  });

  it("logs the probed music and goes on", async () => {
    const music = make("bed.wav", ["-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000:duration=2", "-ac", "2"]);
    const result = await prepareFootage(filmWithMusic(music), run());
    expect(result.ok).toBe(true);
    expect(lines).toContain(`music: ${music} (pcm_s16le, 2.0 s, 48000 Hz, 2 channels, 1536 kb/s).`);
  });
});
