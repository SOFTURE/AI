import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { getFootageSfxCues } from "./compose.js";
import { buildFilmMixArgs } from "./film-mix.js";
import type { Edl } from "./edl.js";
import { DEFAULT_EDIT, type FootageFilm } from "./film.js";

const hasFfmpeg = spawnSync("ffmpeg", ["-version"]).status === 0;

describe("buildFilmMixArgs (issue #1124)", () => {
  it("mixes the speech, the music and each sound effect as the composition plays them, to the film's length", () => {
    const args = buildFilmMixArgs({
      speech: { file: "/b/assets/speech.mp3", seconds: 7.5 },
      music: { file: "/b/assets/music.mp3", seconds: 10.5 },
      sfx: [{ src: "/b/assets/sfx/whoosh.mp3", t: 3.25, volume: 0.45, dur: 0.57 }],
      seconds: 10.5,
      output: "/b/mix.wav",
    });
    const format = "aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo";
    expect(args).toEqual([
      "-v",
      "error",
      "-y",
      "-i",
      "/b/assets/speech.mp3",
      "-i",
      "/b/assets/music.mp3",
      "-i",
      "/b/assets/sfx/whoosh.mp3",
      "-filter_complex",
      `[0:a]atrim=duration=7.5,${format}[a0];[1:a]atrim=duration=10.5,${format}[a1];` +
        `[2:a]atrim=duration=0.57,${format},volume=0.45,adelay=delays=3250:all=1[a2];` +
        "[a0][a1][a2]amix=inputs=3:duration=longest:normalize=0,apad=whole_dur=10.5,atrim=duration=10.5[mix]",
      "-map",
      "[mix]",
      "-t",
      "10.5",
      "-c:a",
      "pcm_f32le",
      "-ar",
      "48000",
      "-ac",
      "2",
      "/b/mix.wav",
    ]);
  });

  it("passes the speech alone through when there is nothing to mix under it", () => {
    const args = buildFilmMixArgs({ speech: { file: "/b/speech.mp3", seconds: 4 }, music: null, sfx: [], seconds: 7, output: "/b/mix.wav" });
    expect(args[args.indexOf("-filter_complex") + 1]).toBe("[0:a]atrim=duration=4,aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo[a0];[a0]anull,apad=whole_dur=7,atrim=duration=7[mix]");
  });

  it("refuses a film length that is not a positive number, so the mix can never run unbounded", () => {
    for (const seconds of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => buildFilmMixArgs({ speech: { file: "/b/speech.mp3", seconds: 4 }, music: null, sfx: [], seconds, output: "/b/mix.wav" })).toThrow(
        `buildFilmMixArgs: the film's length must be a positive number of seconds, got ${String(seconds)}.`,
      );
    }
  });
});

describe("getFootageSfxCues (issue #1124)", () => {
  const edl = {
    segments: [
      { id: "s1", clip: "talk", start: 0, end: 2, transition: "cut" },
      { id: "s2", clip: "talk", start: 3, end: 5, transition: "whoosh" },
    ],
  } as unknown as Edl;
  const film = { endCard: { headline: "Hi" }, edit: { ...DEFAULT_EDIT, isEndCardWhoosh: true } } as unknown as FootageFilm;

  it("plays a whoosh before every whoosh cut and the end card's whoosh and pop, skipping events without a file", () => {
    expect(getFootageSfxCues(film, edl, { whoosh: "assets/sfx/whoosh.mp3", pop: "assets/sfx/pop.mp3" })).toEqual([
      { src: "assets/sfx/whoosh.mp3", t: 1.9, volume: 0.45, dur: 0.57 },
      { src: "assets/sfx/whoosh.mp3", t: 4, volume: 0.3, dur: 0.57 },
      { src: "assets/sfx/pop.mp3", t: 4.9, volume: 0.35, dur: 0.72 },
    ]);
    expect(getFootageSfxCues(film, edl, {})).toEqual([]);
  });
});

describe.runIf(hasFfmpeg)("buildFilmMixArgs with ffmpeg (issue #1124)", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "film-mix-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  function makeTone(name: string, seconds: number, frequency: number): string {
    const file = join(dir, name);
    expect(spawnSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", `sine=f=${frequency}:d=${seconds}:r=44100`, "-c:a", "libmp3lame", file]).status).toBe(0);
    return file;
  }

  /** The mean level of the mix between two seconds, in dB. */
  function getLevel(file: string, start: number, end: number): number {
    const result = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", file, "-af", `atrim=start=${start}:end=${end},volumedetect`, "-f", "null", "-"], { encoding: "utf8" });
    const match = /mean_volume: (-?\d+(?:\.\d+)?) dB/.exec(result.stderr);
    return match?.[1] === undefined ? Number.NEGATIVE_INFINITY : Number(match[1]);
  }

  it("writes a 48 kHz stereo mix exactly the film's length, the effect heard only where it plays", () => {
    const output = join(dir, "mix.wav");
    const speech = makeTone("speech.mp3", 2, 440);
    const whoosh = makeTone("whoosh.mp3", 1, 2000);
    const made = spawnSync("ffmpeg", buildFilmMixArgs({ speech: { file: speech, seconds: 2 }, music: null, sfx: [{ src: whoosh, t: 3, volume: 0.5, dur: 0.5 }], seconds: 5, output }), { encoding: "utf8" });
    expect(made.status, made.stderr).toBe(0);
    const probe = spawnSync("ffprobe", ["-v", "error", "-show_entries", "stream=sample_rate,channels:format=duration", "-of", "csv=p=0", output], { encoding: "utf8" });
    const [stream, duration] = probe.stdout.trim().split("\n");
    expect(stream).toBe("48000,2");
    expect(Math.abs(Number(duration) - 5)).toBeLessThan(0.01);
    expect(getLevel(output, 0.2, 1.8)).toBeGreaterThan(-30);
    expect(getLevel(output, 2.2, 2.9)).toBeLessThan(-80);
    expect(getLevel(output, 3.05, 3.45)).toBeGreaterThan(-36);
    expect(getLevel(output, 3.6, 4.9)).toBeLessThan(-80);
  });
});
