import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildClipSoundArgs, buildClipSoundMeasureArgs, getAudioCodecArgs, getPreGainDb, prepareClipSounds, SPEECH_PRE_GAIN, type ClipSoundInput } from "./clip-sound.js";
import { buildLoudnessArgs, buildLoudnessMeasureArgs, DEFAULT_LOUDNESS, readLoudnessMeasurement, type LoudnessMeasurement } from "./loudness.js";
import { buildSpeechArgs } from "./render.js";

const measurement = (inputI: number, inputTp: number): LoudnessMeasurement => ({ inputI, inputTp, inputLra: 3, inputThresh: inputI - 10, targetOffset: 0 });

const input = (changes: Partial<ClipSoundInput> = {}): ClipSoundInput => ({
  clip: { id: "talk", role: "talk", trim: { start: 1.5, end: 4 } },
  source: "/src/talk.mov",
  probe: { hasAudio: true },
  duration: 2.5,
  ...changes,
});

describe("getPreGainDb", () => {
  it("raises quiet speech to the target", () => {
    expect(getPreGainDb(measurement(-40.7, -15.5))).toBe(12.5);
    expect(getPreGainDb(measurement(-40, -30))).toBe(17);
  });

  it("stops where the true peak reaches the ceiling", () => {
    expect(getPreGainDb(measurement(-40, -10))).toBe(7);
    expect(getPreGainDb(measurement(-20, -1))).toBe(-3);
  });

  it("leaves silence and a clip without sound as they are", () => {
    expect(getPreGainDb(null)).toBe(0);
    expect(getPreGainDb(measurement(-Infinity, -Infinity))).toBe(0);
    expect(getPreGainDb(measurement(-80, -60))).toBe(0);
  });
});

describe("the clip sound's ffmpeg arguments", () => {
  it("measures the trimmed sound after the extraction's format change", () => {
    expect(buildClipSoundMeasureArgs(input())).toEqual([
      "-hide_banner",
      "-nostats",
      "-ss",
      "1.5",
      "-i",
      "/src/talk.mov",
      "-t",
      "2.500",
      "-map",
      "0:a:0",
      "-vn",
      "-af",
      `aformat=sample_rates=48000:channel_layouts=stereo,loudnorm=I=${String(SPEECH_PRE_GAIN.target)}:TP=${String(SPEECH_PRE_GAIN.peakCeiling)}:LRA=11:print_format=json`,
      "-f",
      "null",
      "-",
    ]);
  });

  it("writes the gained, trimmed sound as 24-bit 48 kHz stereo WAV, and silence for a clip without sound", () => {
    expect(buildClipSoundArgs({ ...input(), gainDb: 12.5, output: "/b/audio/talk.wav" })).toEqual([
      "-v",
      "error",
      "-y",
      "-ss",
      "1.5",
      "-i",
      "/src/talk.mov",
      "-t",
      "2.500",
      "-map",
      "0:a:0",
      "-vn",
      "-af",
      "aformat=sample_rates=48000:channel_layouts=stereo,volume=12.5dB",
      "-ar",
      "48000",
      "-ac",
      "2",
      "-c:a",
      "pcm_s24le",
      "/b/audio/talk.wav",
    ]);
    const silent = buildClipSoundArgs({ ...input({ probe: { hasAudio: false } }), gainDb: 0, output: "/b/audio/talk.wav" });
    expect(silent.slice(3, 9)).toEqual(["-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo", "-t", "2.500"]);
    expect(silent).not.toContain("/src/talk.mov");
  });

  it("encodes an intermediate file by its extension", () => {
    expect(getAudioCodecArgs("/a/speech.wav")).toEqual(["-c:a", "pcm_f32le"]);
    expect(getAudioCodecArgs("/a/speech.WAV")).toEqual(["-c:a", "pcm_f32le"]);
    expect(getAudioCodecArgs("/a/speech.flac")).toEqual(["-c:a", "flac"]);
    expect(getAudioCodecArgs("/a/speech.mp3")).toEqual(["-c:a", "libmp3lame", "-q:a", "2"]);
  });
});

const hasFfmpeg = spawnSync("ffprobe", ["-version"]).status === 0 && spawnSync("ffmpeg", ["-version"]).status === 0;

describe.runIf(hasFfmpeg)("prepareClipSounds and the lossless chain (issue #1139)", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "footage-clip-sound-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  function ffmpeg(args: string[]): string {
    const result = spawnSync("ffmpeg", args, { encoding: "utf8" });
    if (result.status !== 0) throw new Error(`ffmpeg ${args.join(" ")}: ${result.stderr}`);
    return result.stderr;
  }

  /** A phone-like clip: 6 s of picture, `audio` (a lavfi graph) as its 16-bit sound. */
  function makeClip(name: string, audio: string): string {
    const file = join(dir, name);
    ffmpeg(["-v", "error", "-y", "-f", "lavfi", "-i", "color=c=black:s=64x64:d=6", "-f", "lavfi", "-i", audio, "-shortest", "-pix_fmt", "yuv420p", "-c:a", "pcm_s16le", file]);
    return file;
  }

  function measure(file: string): LoudnessMeasurement {
    const measured = readLoudnessMeasurement(spawnSync("ffmpeg", buildLoudnessMeasureArgs(file, DEFAULT_LOUDNESS), { encoding: "utf8" }).stderr);
    if (measured === null) throw new Error(`no measurement for ${file}`);
    return measured;
  }

  function getDuration(file: string): number {
    return Number(spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file], { encoding: "utf8" }).stdout.trim());
  }

  const clip = (id: string, source: string, role: "talk" | "broll", trim = { start: 0, end: null as number | null }, duration = 6): ClipSoundInput => ({
    clip: { id, role, trim },
    source,
    probe: { hasAudio: true },
    duration,
  });

  it("brings a -40 LUFS clip to -23 LUFS, caps a loud one at the peak ceiling, keeps the trimmed length, and gains a b-roll by the talking clips' mean", async () => {
    const quiet = makeClip("quiet.mov", "sine=frequency=440:sample_rate=48000:duration=6,volume=0.0108");
    const peaky = makeClip("peaky.mov", "sine=frequency=440:sample_rate=48000:duration=6,volume=0.9");
    const street = makeClip("street.mov", "anoisesrc=d=6:c=pink:a=0.01:r=48000");
    const sounds = await prepareClipSounds([clip("quiet", quiet, "talk", { start: 1, end: 4 }, 3), clip("peaky", peaky, "talk"), clip("street", street, "broll")], { buildDir: join(dir, "build") });
    const quietSound = sounds.quiet;
    const peakySound = sounds.peaky;
    if (quietSound === undefined || peakySound === undefined) throw new Error("expected both talking clips");
    expect(quietSound.file).toBe(join(dir, "build", "audio", "quiet.wav"));
    expect(Math.abs(measure(quietSound.file).inputI - SPEECH_PRE_GAIN.target)).toBeLessThan(0.5);
    expect(Math.abs(getDuration(quietSound.file) - 3)).toBeLessThan(0.01);
    expect(peakySound.gainDb).toBeLessThan(0);
    expect(measure(peakySound.file).inputTp).toBeLessThanOrEqual(SPEECH_PRE_GAIN.peakCeiling + 0.1);
    expect(sounds.street?.gainDb).toBe(Math.round(((quietSound.gainDb + peakySound.gainDb) / 2) * 100) / 100);
  });

  it("keeps the pauses' noise and the voice's purity of a quiet clip as a lossless loudnorm from the clip does", async () => {
    // Speech at about -40 LUFS: a 220 Hz tone in bursts over a faint noise floor, the pauses between them.
    const speech = "sine=frequency=220:sample_rate=48000:duration=6,volume=0.14,volume='if(lt(mod(t,1.5),1),1,0)':eval=frame";
    const source = makeClip("talk.mov", `${speech}[s];anoisesrc=d=6:c=white:a=0.0015:r=48000[n];[s][n]amix=inputs=2:normalize=0`);
    const sounds = await prepareClipSounds([clip("talk", source, "talk")], { buildDir: join(dir, "build") });
    const raw = join(dir, "speech.raw.wav");
    ffmpeg(buildSpeechArgs({ version: 2, film: "f", segments: [{ id: "s1", clip: "talk", start: 0, end: 6, transition: "cut", motion: "none" }] }, { talk: sounds.talk?.file ?? "" }, raw));
    const chain = join(dir, "speech.wav");
    ffmpeg(buildLoudnessArgs({ input: raw, measurement: measure(raw), target: DEFAULT_LOUDNESS, output: chain }));
    // The reference: one linear loudnorm straight from the clip, lossless.
    const reference = join(dir, "reference.wav");
    const sourceSound = join(dir, "source.wav");
    ffmpeg(["-v", "error", "-y", "-i", source, "-vn", "-ac", "2", "-c:a", "pcm_f32le", sourceSound]);
    ffmpeg(buildLoudnessArgs({ input: sourceSound, measurement: measure(sourceSound), target: DEFAULT_LOUDNESS, output: reference }));
    expect(Math.abs(measure(chain).inputI - DEFAULT_LOUDNESS.target)).toBeLessThan(0.5);
    // The noise in the pauses (5th percentile of 50 ms RMS windows) and the noise beside the tone, against the reference.
    expect(getPauseNoiseDb(chain) - getPauseNoiseDb(reference)).toBeLessThan(0.5);
    expect(getToneResidualDb(chain) - getToneResidualDb(reference)).toBeLessThan(0.5);
    expect(Math.abs(measure(sounds.talk?.file ?? "").inputI - SPEECH_PRE_GAIN.target)).toBeLessThan(0.5);
    // Sample by sample (past the cut's 20 ms edge fades) the chain is the reference: no lossy encode left anything behind.
    expect(getDifferenceDb(chain, reference)).toBeLessThan(-40);
  });

  /** The RMS of `a - b` (between 0.05 s and 5.95 s) against the RMS of `b`, in dB. */
  function getDifferenceDb(a: string, b: string): number {
    const rms = (args: string[]): number => Number(/RMS level dB:\s+(-?[\d.]+|-inf)/.exec(ffmpeg(["-v", "info", ...args, "-f", "null", "-"]))?.[1]?.replace("-inf", "-200"));
    const difference = rms(["-i", a, "-i", b, "-filter_complex", "[0:a][1:a]amerge=inputs=2,pan=stereo|c0=c0-c2|c1=c1-c3,atrim=start=0.05:end=5.95,astats=measure_perchannel=none"]);
    return difference - rms(["-i", b, "-af", "astats=measure_perchannel=none"]);
  }

  /** The 5th percentile of 50 ms RMS windows, in dB: the noise floor in the pauses. */
  function getPauseNoiseDb(file: string): number {
    const stderr = ffmpeg(["-v", "info", "-i", file, "-af", "asetnsamples=n=2400,astats=metadata=1:reset=1,ametadata=print:key=lavfi.astats.Overall.RMS_level", "-f", "null", "-"]);
    const levels = [...stderr.matchAll(/RMS_level=(-?[\d.]+|-inf)/g)].map((match) => (match[1] === "-inf" ? -200 : Number(match[1]))).sort((a, b) => a - b);
    return levels[Math.floor(levels.length * 0.05)] ?? 0;
  }

  /** What is left beside the 220 Hz voice, relative to the whole, in dB: the lower, the purer the voice. */
  function getToneResidualDb(file: string): number {
    const rms = (filter: string): number => {
      const match = /RMS level dB:\s+(-?[\d.]+)/.exec(ffmpeg(["-v", "info", "-i", file, "-af", `${filter}astats=measure_perchannel=none`, "-f", "null", "-"]));
      return Number(match?.[1]);
    };
    return rms("bandreject=f=220:width_type=q:w=4,") - rms("");
  }
});
