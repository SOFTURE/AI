import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  buildChannelMeasureArgs,
  buildClipSoundArgs,
  buildClipSoundMeasureArgs,
  describeChannelFold,
  describeSpeechPreGain,
  getChannelBalance,
  getChannelFoldFilter,
  ONE_SIDED_CHANNEL,
  readChannelRmsDb,
  getAudioCodecArgs,
  getPreGainDb,
  getSpeechPreGain,
  prepareClipSounds,
  SPEECH_PRE_GAIN,
  type ClipSoundInput,
} from "./clip-sound.js";
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

describe("getSpeechPreGain (issue #1181)", () => {
  it("says a clip reached the target, with its measurement before and after", () => {
    expect(getSpeechPreGain(measurement(-41.82, -26.31))).toEqual({
      gainDb: 18.82,
      preGain: { kind: "on_target", inputLufs: -41.82, inputTruePeakDbtp: -26.31, reachedLufs: -23, truePeakDbtp: -7.49 },
    });
  });

  it("says the peak ceiling held a peaky quiet clip under the target, and where it landed", () => {
    expect(getSpeechPreGain(measurement(-38.73, -15.47))).toEqual({
      gainDb: 12.47,
      preGain: { kind: "held_by_peak_ceiling", inputLufs: -38.73, inputTruePeakDbtp: -15.47, reachedLufs: -26.26, truePeakDbtp: -3 },
    });
  });

  it("with float peaks raises the peaky clip to the target and says its peak is over the ceiling", () => {
    expect(getSpeechPreGain(measurement(-38.73, -15.47), { peaks: "float" })).toEqual({
      gainDb: 15.73,
      preGain: { kind: "peaks_over_ceiling", inputLufs: -38.73, inputTruePeakDbtp: -15.47, reachedLufs: -23, truePeakDbtp: 0.26 },
    });
    expect(getSpeechPreGain(measurement(-41.82, -26.31), { peaks: "float" }).preGain.kind).toBe("on_target");
  });

  it("answers silence for a clip without sound and for silence", () => {
    expect(getSpeechPreGain(null)).toEqual({ gainDb: 0, preGain: { kind: "silent" } });
    expect(getSpeechPreGain(measurement(-80, -60), { peaks: "float" })).toEqual({ gainDb: 0, preGain: { kind: "silent" } });
  });

  it("logs only a clip the ceiling held, or whose peaks pass it", () => {
    const held = getSpeechPreGain(measurement(-38.73, -15.47));
    expect(describeSpeechPreGain("talk", held)).toBe(
      'speech pre-gain: clip talk held by the -3 dBTP peak ceiling at +12.47 dB: it reaches -26.26 LUFS, not -23 (input -38.73 LUFS, -15.47 dBTP). speechPeaks: "float" reaches the target without clipping.',
    );
    expect(describeSpeechPreGain("talk", getSpeechPreGain(measurement(-38.73, -15.47), { peaks: "float" }))).toBe(
      "speech pre-gain: clip talk raised by +15.73 dB to -23 LUFS (input -38.73 LUFS, -15.47 dBTP); its true peak 0.26 dBTP is over the -3 dBTP ceiling, kept by the 32-bit float sound.",
    );
    expect(describeSpeechPreGain("talk", getSpeechPreGain(measurement(-41.82, -26.31)))).toBeNull();
    expect(describeSpeechPreGain("street", { gainDb: 3, preGain: { kind: "shared" } })).toBeNull();
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

  it("writes the sound as 32-bit float with float peaks", () => {
    const args = buildClipSoundArgs({ ...input(), gainDb: 15.73, output: "/b/audio/talk.wav", peaks: "float" });
    expect(args.slice(-3)).toEqual(["-c:a", "pcm_f32le", "/b/audio/talk.wav"]);
  });

  it("encodes an intermediate file by its extension", () => {
    expect(getAudioCodecArgs("/a/speech.wav")).toEqual(["-c:a", "pcm_f32le"]);
    expect(getAudioCodecArgs("/a/speech.WAV")).toEqual(["-c:a", "pcm_f32le"]);
    expect(getAudioCodecArgs("/a/speech.flac")).toEqual(["-c:a", "flac"]);
    expect(getAudioCodecArgs("/a/speech.mp3")).toEqual(["-c:a", "libmp3lame", "-q:a", "2"]);
  });
});

describe("the clip's channel balance (issue #1385)", () => {
  it("calls a stereo clip with a dead right channel left-only, and one with a dead left channel right-only", () => {
    expect(getChannelBalance([-20.54, -116.57])).toEqual({ kind: "one_sided", live: "left", liveRmsDb: -20.54, deadRmsDb: -116.57 });
    expect(getChannelBalance([-Infinity, -24])).toEqual({ kind: "one_sided", live: "right", liveRmsDb: -24, deadRmsDb: -Infinity });
  });

  it("keeps real stereo, a quiet but live second mic, mono, silence and more than two channels balanced", () => {
    expect(getChannelBalance([-20, -23])).toEqual({ kind: "balanced" });
    expect(getChannelBalance([-20, -65])).toEqual({ kind: "balanced" });
    expect(getChannelBalance([-24])).toEqual({ kind: "balanced" });
    expect(getChannelBalance([])).toEqual({ kind: "balanced" });
    expect(getChannelBalance([-Infinity, -Infinity])).toEqual({ kind: "balanced" });
    expect(getChannelBalance([-20, -120, -20])).toEqual({ kind: "balanced" });
  });

  it("needs the dead channel under the ceiling and the gap at least the minimum, at the exact bounds", () => {
    const { deadCeilingDb, minGapDb } = ONE_SIDED_CHANNEL;
    expect(getChannelBalance([deadCeilingDb + minGapDb, deadCeilingDb])).toEqual({ kind: "balanced" });
    expect(getChannelBalance([deadCeilingDb + minGapDb - 0.5, deadCeilingDb - 0.5]).kind).toBe("one_sided");
    expect(getChannelBalance([deadCeilingDb + minGapDb - 1, deadCeilingDb - 0.5])).toEqual({ kind: "balanced" });
    expect(getChannelBalance([-80, -100])).toEqual({ kind: "balanced" });
  });

  it("reads each channel's RMS from astats' log, digital silence as minus infinity", () => {
    const stderr = [
      "[Parsed_astats_0 @ 0x1] Channel: 1",
      "[Parsed_astats_0 @ 0x1] RMS level dB: -20.541219",
      "[Parsed_astats_0 @ 0x1] Channel: 2",
      "[Parsed_astats_0 @ 0x1] RMS level dB: -inf",
    ].join("\n");
    expect(readChannelRmsDb(stderr)).toEqual([-20.541219, -Infinity]);
    expect(readChannelRmsDb("[Parsed_astats_0 @ 0x1] RMS level dB: -3")).toEqual([-3]);
    expect(readChannelRmsDb("no measurement")).toEqual([]);
  });

  it("copies the live channel onto both, and leaves a balanced clip without a filter", () => {
    expect(getChannelFoldFilter({ kind: "balanced" })).toBe("");
    expect(getChannelFoldFilter({ kind: "one_sided", live: "left", liveRmsDb: -20, deadRmsDb: -116 })).toBe("pan=stereo|c0=c0|c1=c0,");
    expect(getChannelFoldFilter({ kind: "one_sided", live: "right", liveRmsDb: -20, deadRmsDb: -116 })).toBe("pan=stereo|c0=c1|c1=c1,");
  });

  it("logs a folded clip with both levels, and nothing for a balanced one", () => {
    expect(describeChannelFold("talk", { kind: "one_sided", live: "left", liveRmsDb: -20.54, deadRmsDb: -116.57 })).toBe(
      "clip sound: clip talk has sound only in its left channel (-20.5 dBFS RMS, right -116.6 dBFS); the left channel is played on both.",
    );
    expect(describeChannelFold("street", { kind: "one_sided", live: "right", liveRmsDb: -30, deadRmsDb: -Infinity })).toBe(
      "clip sound: clip street has sound only in its right channel (-30 dBFS RMS, left silent); the right channel is played on both.",
    );
    expect(describeChannelFold("talk", { kind: "balanced" })).toBeNull();
  });

  it("measures each channel of the trimmed source as it is, before any format change", () => {
    expect(buildChannelMeasureArgs(input())).toEqual([
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
      "astats=measure_overall=none:measure_perchannel=RMS_level",
      "-f",
      "null",
      "-",
    ]);
    expect(buildChannelMeasureArgs(input({ clip: { id: "talk", role: "talk", trim: { start: 0, end: null } } })).slice(2, 4)).toEqual(["-i", "/src/talk.mov"]);
  });

  it("folds a one-sided clip ahead of the format change in both the loudness measure and the extraction", () => {
    const balance = { kind: "one_sided", live: "left", liveRmsDb: -20, deadRmsDb: -116 } as const;
    const measure = buildClipSoundMeasureArgs({ ...input(), balance });
    expect(measure[measure.indexOf("-af") + 1]).toBe(
      `pan=stereo|c0=c0|c1=c0,aformat=sample_rates=48000:channel_layouts=stereo,loudnorm=I=${String(SPEECH_PRE_GAIN.target)}:TP=${String(SPEECH_PRE_GAIN.peakCeiling)}:LRA=11:print_format=json`,
    );
    const extract = buildClipSoundArgs({ ...input(), gainDb: 3, output: "/b/audio/talk.wav", balance: { ...balance, live: "right" } });
    expect(extract[extract.indexOf("-af") + 1]).toBe("pan=stereo|c0=c1|c1=c1,aformat=sample_rates=48000:channel_layouts=stereo,volume=3dB");
  });

  it("gives a balanced clip exactly the arguments it had without a balance", () => {
    const balanced = { kind: "balanced" } as const;
    expect(buildClipSoundMeasureArgs({ ...input(), balance: balanced })).toEqual(buildClipSoundMeasureArgs(input()));
    expect(buildClipSoundArgs({ ...input(), gainDb: 1, output: "/o.wav", balance: balanced })).toEqual(buildClipSoundArgs({ ...input(), gainDb: 1, output: "/o.wav" }));
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

  it("says the ceiling held quiet speech with three 1 ms peaks, and with float peaks reaches -23 LUFS with the peaks and the envelope intact (issue #1181)", async () => {
    // Speech-like bursts at about -40 LUFS, plus three 1 ms clicks at about -15.5 dBFS (a crest of about 25 dB).
    const speech = "sine=frequency=220:sample_rate=48000:duration=6,volume=0.02,volume='if(lt(mod(t,1.5),1),1,0)':eval=frame";
    const clicks = "aevalsrc='0.168*(between(t,0.5,0.501)+between(t,2.2,2.201)+between(t,4.1,4.101))':s=48000:d=6";
    const source = makeClip("peaky.mov", `${speech}[s];${clicks}[c];[s][c]amix=inputs=2:normalize=0`);
    const lines: string[] = [];
    const held = await prepareClipSounds([clip("talk", source, "talk")], { buildDir: join(dir, "held"), log: (line) => lines.push(line) });
    const heldSound = held.talk;
    if (heldSound === undefined || heldSound.preGain.kind !== "held_by_peak_ceiling") throw new Error(`expected the ceiling to hold the gain: ${JSON.stringify(heldSound)}`);
    expect(heldSound.preGain.reachedLufs).toBeLessThan(SPEECH_PRE_GAIN.target - 2);
    expect(Math.abs(measure(heldSound.file).inputI - heldSound.preGain.reachedLufs)).toBeLessThan(0.5);
    expect(lines).toEqual([describeSpeechPreGain("talk", heldSound)]);

    const float = await prepareClipSounds([clip("talk", source, "talk")], { buildDir: join(dir, "float"), peaks: "float" });
    const floatSound = float.talk;
    if (floatSound === undefined || floatSound.preGain.kind !== "peaks_over_ceiling") throw new Error(`expected the float sound over the ceiling: ${JSON.stringify(floatSound)}`);
    const reached = measure(floatSound.file);
    expect(Math.abs(reached.inputI - SPEECH_PRE_GAIN.target)).toBeLessThan(0.5);
    expect(reached.inputTp).toBeGreaterThan(SPEECH_PRE_GAIN.peakCeiling);
    expect(getCodec(floatSound.file)).toBe("pcm_f32le");
    // One linear gain: the float sound is the held one raised by the gains' difference, sample by sample.
    const raised = join(dir, "raised.wav");
    ffmpeg(["-v", "error", "-y", "-i", heldSound.file, "-af", `volume=${String(floatSound.gainDb - heldSound.gainDb)}dB`, "-c:a", "pcm_f32le", raised]);
    expect(getDifferenceDb(floatSound.file, raised)).toBeLessThan(-60);
  });

  function getCodec(file: string): string {
    return spawnSync("ffprobe", ["-v", "error", "-select_streams", "a:0", "-show_entries", "stream=codec_name", "-of", "csv=p=0", file], { encoding: "utf8" }).stdout.trim();
  }

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

describe.runIf(hasFfmpeg)("prepareClipSounds with a voice in one channel (issue #1385)", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "footage-clip-channels-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  function ffmpeg(args: string[]): string {
    const result = spawnSync("ffmpeg", args, { encoding: "utf8" });
    if (result.status !== 0) throw new Error(`ffmpeg ${args.join(" ")}: ${result.stderr}`);
    return result.stderr;
  }

  /** A 4 s clip with stereo AAC sound made by `stereo` (a lavfi graph ending in a stereo stream), as a phone writes it. */
  function makeStereoClip(name: string, stereo: string): string {
    const file = join(dir, name);
    ffmpeg(["-v", "error", "-y", "-f", "lavfi", "-i", "color=c=black:s=64x64:d=4", "-f", "lavfi", "-i", stereo, "-shortest", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", file]);
    return file;
  }

  /** Each channel's RMS in dBFS. */
  function getChannelRms(file: string): number[] {
    return readChannelRmsDb(ffmpeg(["-v", "info", "-i", file, "-af", "astats=measure_overall=none:measure_perchannel=RMS_level", "-f", "null", "-"]));
  }

  const voice = "sine=frequency=220:sample_rate=48000:duration=4,volume=0.05,volume='if(lt(mod(t,1.5),1),1,0)':eval=frame";
  const silence = "anullsrc=r=48000:cl=mono:d=4";
  const clip = (id: string, source: string, role: "talk" | "broll"): ClipSoundInput => ({ clip: { id, role, trim: { start: 0, end: null } }, source, probe: { hasAudio: true }, duration: 4 });

  it("plays a left-only voice and a right-only b-roll on both channels, the voice at the pre-gain target, and logs both folds", async () => {
    const talk = makeStereoClip("talk.mp4", `${voice}[v];${silence}[s];[v][s]join=inputs=2:channel_layout=stereo`);
    const street = makeStereoClip("street.mp4", `${silence}[s];anoisesrc=d=4:c=pink:a=0.02:r=48000[n];[s][n]join=inputs=2:channel_layout=stereo`);
    const [talkLeft = 0, talkRight = 0] = getChannelRms(talk);
    expect(talkLeft - talkRight).toBeGreaterThan(ONE_SIDED_CHANNEL.minGapDb);
    const lines: string[] = [];
    const sounds = await prepareClipSounds([clip("talk", talk, "talk"), clip("street", street, "broll")], { buildDir: join(dir, "build"), log: (line) => lines.push(line) });
    expect(sounds.talk?.channels).toMatchObject({ kind: "one_sided", live: "left" });
    expect(sounds.street?.channels).toMatchObject({ kind: "one_sided", live: "right" });
    for (const id of ["talk", "street"]) {
      const [left = 0, right = -200] = getChannelRms(sounds[id]?.file ?? "");
      expect(Math.abs(left - right)).toBeLessThan(1);
      expect(right).toBeGreaterThan(-50);
    }
    const measured = readLoudnessMeasurement(spawnSync("ffmpeg", buildLoudnessMeasureArgs(sounds.talk?.file ?? "", DEFAULT_LOUDNESS), { encoding: "utf8" }).stderr);
    expect(Math.abs((measured?.inputI ?? 0) - SPEECH_PRE_GAIN.target)).toBeLessThan(0.5);
    expect(lines.filter((line) => line.startsWith("clip sound:"))).toEqual([
      describeChannelFold("talk", sounds.talk?.channels ?? { kind: "balanced" }),
      describeChannelFold("street", sounds.street?.channels ?? { kind: "balanced" }),
    ]);
  });

  it("carries the folded voice to both channels of the speech track", async () => {
    const talk = makeStereoClip("talk.mp4", `${voice}[v];${silence}[s];[v][s]join=inputs=2:channel_layout=stereo`);
    const sounds = await prepareClipSounds([clip("talk", talk, "talk")], { buildDir: join(dir, "build") });
    const speech = join(dir, "speech.wav");
    ffmpeg(buildSpeechArgs({ version: 2, film: "f", segments: [{ id: "s1", clip: "talk", start: 0.5, end: 3.5, transition: "cut", motion: "none" }] }, { talk: sounds.talk?.file ?? "" }, speech));
    const [left = 0, right = -200] = getChannelRms(speech);
    expect(Math.abs(left - right)).toBeLessThan(1);
  });

  it("keeps a true stereo clip's channels as they were", async () => {
    const wide = makeStereoClip("wide.mp4", `${voice}[v];anoisesrc=d=4:c=pink:a=0.01:r=48000[n];[v][n]join=inputs=2:channel_layout=stereo`);
    const [sourceLeft = 0, sourceRight = 0] = getChannelRms(wide);
    const sounds = await prepareClipSounds([clip("wide", wide, "talk")], { buildDir: join(dir, "build") });
    expect(sounds.wide?.channels).toEqual({ kind: "balanced" });
    const [left = 0, right = 0] = getChannelRms(sounds.wide?.file ?? "");
    expect(Math.abs(left - right - (sourceLeft - sourceRight))).toBeLessThan(0.5);
  });

  it("names the clip when its channels cannot be measured", async () => {
    const broken = join(dir, "broken.mp4");
    await expect(prepareClipSounds([clip("broken", broken, "talk")], { buildDir: join(dir, "build") })).rejects.toThrow(/Measuring the channels of clip broken: ffmpeg ended with code/);
  });
});
