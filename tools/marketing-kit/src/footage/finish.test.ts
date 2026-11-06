import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { DEFAULT_LOUDNESS, normalizeLoudness, readLoudnessMeasurement, type LoudnessMeasurement, type MixLoudnessTarget } from "./loudness.js";
import { finishFootage, mixFootage } from "./pipeline.js";
import type { FinishVideo } from "./publish.js";

/** The #1085 fixtures' length: three 3 s periods of speech and pauses. */
const TALK_SECONDS = 9;

const hasFfmpeg = spawnSync("ffprobe", ["-version"]).status === 0 && spawnSync("ffmpeg", ["-version"]).status === 0;

/** A film's mix as loudnorm measures it. */
function measure(file: string): LoudnessMeasurement {
  const result = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", file, "-vn", "-af", "loudnorm=I=-14:TP=-1:LRA=11:print_format=json", "-f", "null", "-"], { encoding: "utf8" });
  const measurement = readLoudnessMeasurement(result.stderr);
  if (measurement === null) throw new Error(`no loudness measurement for ${file}: ${result.stderr}`);
  return measurement;
}

function getCodecs(file: string): string[] {
  const result = spawnSync("ffprobe", ["-v", "error", "-show_entries", "stream=codec_name", "-of", "csv=p=0", file], { encoding: "utf8" });
  return result.stdout.trim().split("\n");
}

function getPicture(file: string): string[] {
  const result = spawnSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=codec_name,profile,pix_fmt", "-of", "csv=p=0", file], { encoding: "utf8" });
  return result.stdout.trim().split(",");
}

describe.runIf(hasFfmpeg)("finishFootage with ffmpeg (issue #1031)", () => {
  let dir: string;
  let lines: string[];

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "footage-finish-"));
    lines = [];
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  /** A 6 s H.264 + AAC render like hyperframes' output: a quiet voice-like tone that pauses, over a quiet noise bed. */
  function makeRender(audio: string, video: { preset: string } = { preset: "medium" }, seconds = 6): string {
    const file = join(dir, "render.mp4");
    const made = spawnSync("ffmpeg", [
      "-v",
      "error",
      "-y",
      "-f",
      "lavfi",
      "-i",
      `color=c=black:s=180x320:r=30:d=${seconds}`,
      "-f",
      "lavfi",
      "-i",
      audio,
      "-map",
      "0:v",
      "-map",
      "1:a",
      "-c:v",
      "libx264",
      ...(video.preset === "ultrafast" ? [] : ["-profile:v", "high"]),
      "-preset",
      video.preset,
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-ar",
      "48000",
      "-ac",
      "2",
      "-shortest",
      file,
    ]);
    expect(made.status).toBe(0);
    return file;
  }

  const SPEECH_AND_MUSIC =
    "sine=f=220:d=6:r=48000,volume='if(lt(mod(t,2),1.4),0.06,0)':eval=frame[voice];anoisesrc=d=6:r=48000:a=0.01[bed];[voice][bed]amix=inputs=2,aformat=channel_layouts=stereo";

  async function finish(renderFile: string, mixLoudness?: MixLoudnessTarget | null, finishVideo?: FinishVideo, seconds = 6) {
    const output = join(dir, "film.mp4");
    const result = await finishFootage(
      { cover: null, ...(mixLoudness === undefined ? {} : { mixLoudness }) },
      { renderFile, seconds, coverAt: 0 },
      { output, log: (line) => lines.push(line), ...(finishVideo === undefined ? {} : { finishVideo }) },
    );
    return { output, result };
  }

  it("brings a quiet mix to -14 LUFS ±1 with the true peak at most -1 dBTP, the picture copied", async () => {
    const renderFile = makeRender(SPEECH_AND_MUSIC);
    const before = measure(renderFile).inputI;
    expect(before).toBeLessThan(-25);
    const { output, result } = await finish(renderFile);
    expect(result.ok).toBe(true);
    const after = measure(output);
    expect(Math.abs(after.inputI - DEFAULT_LOUDNESS.target)).toBeLessThanOrEqual(1);
    expect(after.inputTp).toBeLessThanOrEqual(DEFAULT_LOUDNESS.truePeak);
    expect(getCodecs(output)).toEqual(["h264", "aac"]);
    expect(lines.some((line) => line.startsWith(`loudness: the film's mix measured ${before.toFixed(1)} LUFS, true peak `))).toBe(true);
    expect(result.ok && result.value.loudness).toEqual({ integrated: after.inputI, truePeak: after.inputTp, warning: null });
    expect(lines).toContain(`loudness: the finished film measures ${after.inputI.toFixed(1)} LUFS, true peak ${after.inputTp.toFixed(1)} dBTP.`);
    expect(lines.some((line) => line.startsWith("finish: picture copied, sound re-encoded"))).toBe(true);
  });

  it("copies a draft render's Constrained Baseline picture instead of encoding it again (issue #1051)", async () => {
    const renderFile = makeRender("anullsrc=r=48000:cl=stereo:d=6", { preset: "ultrafast" });
    const { result } = await finish(renderFile);
    expect(result.ok).toBe(true);
    expect(lines.some((line) => line.startsWith("finish: streams copied to H.264 Constrained Baseline,"))).toBe(true);
  });

  it("re-encodes a draft render's picture to H.264 High yuv420p with finishVideo (issue #1068)", async () => {
    const renderFile = makeRender("anullsrc=r=48000:cl=stereo:d=6", { preset: "ultrafast" });
    const { output, result } = await finish(renderFile, undefined, { preset: "veryfast", crf: 20, maxBitrate: "2M" });
    expect(result.ok).toBe(true);
    expect(getPicture(output)).toEqual(["h264", "High", "yuv420p"]);
    expect(lines.some((line) => line.startsWith("finish: picture re-encoded (veryfast CRF 20, max 2M), sound copied to H.264 High,"))).toBe(true);
  });

  it("leaves a silent mix as it is", async () => {
    const { output, result } = await finish(makeRender("anullsrc=r=48000:cl=stereo:d=6"));
    expect(result.ok).toBe(true);
    expect(lines).toContain("loudness: the film's mix is silent, left as it is.");
    expect(lines.some((line) => line.startsWith("finish: streams copied"))).toBe(true);
    expect(getCodecs(output)).toEqual(["h264", "aac"]);
  });

  it("keeps the mix as rendered with mixLoudness null", async () => {
    const renderFile = makeRender(SPEECH_AND_MUSIC);
    const before = measure(renderFile).inputI;
    const { output, result } = await finish(renderFile, null);
    expect(result.ok).toBe(true);
    const after = measure(output);
    expect(Math.abs(after.inputI - before)).toBeLessThan(0.1);
    expect(lines.some((line) => line.startsWith("loudness: the film's mix"))).toBe(false);
    expect(result.ok && result.value.loudness).toEqual({ integrated: after.inputI, truePeak: after.inputTp, warning: null });
    expect(result.ok && result.value.mix).toBeNull();
  });

  /** The issue's fixture: pink noise "speech" in bursts over a percussive square wave "music" bed, both loud. */
  function getLoudMusicMix(speech: number, music: number, noise: { seconds: number; seed?: number } = { seconds: 6 }): string {
    const beat = (phase: string): string => `${music}*sgn(sin(2*PI*55*t${phase}))*exp(-30*mod(t,0.25))`;
    const seed = noise.seed === undefined ? "" : `:seed=${noise.seed}`;
    return (
      `anoisesrc=d=${noise.seconds}:c=pink:r=48000:a=${speech}${seed},volume='if(lt(mod(t,2),1.3),1,0.01)':eval=frame,aformat=channel_layouts=stereo[voice];` +
      `aevalsrc='${beat("")}|${beat("+1")}':d=${noise.seconds}:s=48000[music];[voice][music]amix=inputs=2:normalize=0`
    );
  }

  it.each([
    { speech: 0.3, music: 0.6 },
    { speech: 0.6, music: 0.95 },
    { speech: 0.05, music: 0.95 },
  ])("keeps loud percussive music (speech $speech, music $music) at most -1 dBTP and -14 ±1 LUFS in the finished MP4 (issue #1079)", async ({ speech, music }) => {
    const { output, result } = await finish(makeRender(getLoudMusicMix(speech, music)));
    expect(result.ok).toBe(true);
    const after = measure(output);
    expect(after.inputTp).toBeLessThanOrEqual(DEFAULT_LOUDNESS.truePeak);
    expect(Math.abs(after.inputI - DEFAULT_LOUDNESS.target)).toBeLessThanOrEqual(1);
    expect(getCodecs(output)).toEqual(["h264", "aac"]);
    expect(result.ok && Math.abs(result.value.durationSeconds - 6)).toBeLessThan(0.1);
  });

  // The issue's 8 s fixtures over several noise seeds: on 0.12.0 a retry aimed at the window's edge and the limiter
  // took part of the gain back, so about one loud mix in four failed after four encodes with keep speech.
  it.each([
    { speech: 0.3, music: 0.6, seeds: [1, 2, 3] },
    { speech: 0.3, music: 0.9, seeds: [1, 4, 5, 6] },
    { speech: 0.9, music: 0.9, seeds: [1] },
  ])(
    "keeps loud percussive music (speech $speech, music $music) at most -1 dBTP and inside -14 ±1 LUFS with keep speech (issue #1095)",
    async ({ speech, music, seeds }) => {
      for (const seed of seeds) {
        lines = [];
        const renderFile = makeRender(getLoudMusicMix(speech, music, { seconds: 8, seed }), { preset: "ultrafast" }, 8);
        const { output, result } = await finish(renderFile, { ...DEFAULT_LOUDNESS, tolerance: 1, keep: "speech" }, undefined, 8);
        if (!result.ok) throw new Error(`seed ${seed}: ${result.error}`);
        const after = measure(output);
        expect(after.inputTp).toBeLessThanOrEqual(DEFAULT_LOUDNESS.truePeak);
        expect(Math.abs(after.inputI - DEFAULT_LOUDNESS.target)).toBeLessThanOrEqual(1);
        expect(result.value.mix?.keep).toBe("speech");
        expect(lines.some((line) => / \(encode [1-2] of 4, \d+ uncompressed probes\)\.$/.test(line))).toBe(true);
      }
    },
    120_000,
  );

  it("fails the render naming the measurement when no encode of the mix meets the target (issue #1079)", async () => {
    // No mix is -5 LUFS loud with its true peak at -9 dBTP: every encode misses, whatever the limiter does.
    const { output, result } = await finish(makeRender(getLoudMusicMix(0.6, 0.95)), { target: -5, truePeak: -9 });
    expect(result.ok).toBe(false);
    const error = result.ok ? "" : result.error;
    expect(error).toMatch(
      /^the film's mix still measures -?\d+\.\d LUFS integrated, [+-]?\d+\.\d dBTP true peak after 4 encodes \(last: gain [+-]?\d+\.\d dB, limiter at -\d+\.\d dBTP\): (.+; )?integrated -?\d+\.\d LUFS, outside -5\.0 ± 1 LUFS\.$/,
    );
    expect(existsSync(output)).toBe(false);
    expect(existsSync(join(dir, "mix.m4a"))).toBe(false);
    expect(lines.some((line) => line.startsWith("finish:"))).toBe(false);
  });

  /**
   * The issue's fixture for #1085: pink noise "speech" on for `speechOn` s of every 3 s, normalized to -14 LUFS as the
   * render does, under a percussive "music" bed at `volume`, summed without normalization like the render's mix.
   */
  async function makeTalkRender(options: { speechOn: number; volume: number; name: string }): Promise<string> {
    const raw = join(dir, `${options.name}.speech.wav`);
    const speech = join(dir, `${options.name}.speech.mp3`);
    const made = spawnSync("ffmpeg", [
      "-v",
      "error",
      "-y",
      "-f",
      "lavfi",
      "-i",
      `anoisesrc=d=${TALK_SECONDS}:c=pink:r=48000:a=0.2:seed=1085,volume='if(lt(mod(t,3),${options.speechOn}),1,0.0005)':eval=frame`,
      raw,
    ]);
    expect(made.status).toBe(0);
    expect((await normalizeLoudness(raw, speech, DEFAULT_LOUDNESS)).kind).toBe("normalized");
    const music = "0.5*sgn(sin(2*PI*55*t))*exp(-20*mod(t,0.5))+0.2*sin(2*PI*220*t)";
    const file = join(dir, `${options.name}.render.mp4`);
    const rendered = spawnSync("ffmpeg", [
      "-v",
      "error",
      "-y",
      "-f",
      "lavfi",
      "-i",
      `color=c=black:s=180x320:r=30:d=${TALK_SECONDS}`,
      "-i",
      speech,
      "-f",
      "lavfi",
      "-i",
      `aevalsrc='${music}|${music}':d=${TALK_SECONDS}:s=48000`,
      "-filter_complex",
      `[1:a]aformat=channel_layouts=stereo[voice];[2:a]volume=${options.volume}[music];[voice][music]amix=inputs=2:normalize=0:duration=first[a]`,
      "-map",
      "0:v",
      "-map",
      "[a]",
      "-c:v",
      "libx264",
      "-profile:v",
      "high",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      "-ar",
      "48000",
      "-shortest",
      file,
    ]);
    expect(rendered.status).toBe(0);
    return file;
  }

  /** The mean level of a moment without speech (2.7-2.95 s of the 3 s period, past the speech of every fixture), in dB. */
  function getQuietLevel(file: string): number {
    const result = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", file, "-vn", "-af", "atrim=start=5.7:end=5.95,volumedetect", "-f", "null", "-"], { encoding: "utf8" });
    const match = /mean_volume: (-?\d+(?:\.\d+)?) dB/.exec(result.stderr);
    if (match?.[1] === undefined) throw new Error(`no mean volume for ${file}: ${result.stderr}`);
    return Number(match[1]);
  }

  const KEEP_SPEECH: MixLoudnessTarget = { ...DEFAULT_LOUDNESS, tolerance: 1, keep: "speech" };

  it.each([
    { speechOn: 2, volumes: [0.4, 0.5] },
    { speechOn: 2.6, volumes: [0.32, 0.5] },
  ])("keeps the speech's level when only the music volume changes ($volumes, speech $speechOn s of 3 s) with keep speech (issue #1085)", async ({ speechOn, volumes }) => {
    const finished = [];
    for (const volume of volumes) {
      const renderFile = await makeTalkRender({ speechOn, volume, name: `v${volume}` });
      const output = join(dir, `v${volume}.mp4`);
      const result = await finishFootage({ cover: null, mixLoudness: KEEP_SPEECH }, { renderFile, seconds: TALK_SECONDS, coverAt: 0 }, { output, log: (line) => lines.push(line) });
      if (!result.ok) throw new Error(result.error);
      expect(result.value.mix?.keep).toBe("speech");
      const after = measure(output);
      expect(after.inputTp).toBeLessThanOrEqual(DEFAULT_LOUDNESS.truePeak);
      expect(Math.abs(after.inputI - DEFAULT_LOUDNESS.target)).toBeLessThanOrEqual(1);
      finished.push({ volume, gainDb: result.value.mix?.gainDb ?? Number.NaN, quiet: getQuietLevel(output) });
    }
    const [first, second] = finished;
    if (first === undefined || second === undefined) throw new Error("two renders expected");
    // The speech stays where `loudness` put it: the same gain on both mixes.
    expect(Math.abs(second.gainDb - first.gainDb)).toBeLessThanOrEqual(0.1);
    // A music volume step is heard as set in the moments without speech.
    expect(Math.abs(second.quiet - first.quiet - 20 * Math.log10(second.volume / first.volume))).toBeLessThanOrEqual(0.5);
    expect(lines.some((line) => /^loudness: the film's mix measured .+; gain [+-]?\d+\.\d dB \(speech kept: -14\.0 ± 1 LUFS\), limiter at /.test(line))).toBe(true);
  });

  it("brings a talk with long pauses and quiet music into the window, no further (issue #1085)", async () => {
    const renderFile = await makeTalkRender({ speechOn: 1, volume: 0.2, name: "pauses" });
    const { inputI: before, inputTp: peakBefore } = measure(renderFile);
    expect(before).toBeLessThan(-15);
    const output = join(dir, "pauses.mp4");
    const result = await finishFootage({ cover: null, mixLoudness: KEEP_SPEECH }, { renderFile, seconds: TALK_SECONDS, coverAt: 0 }, { output, log: (line) => lines.push(line) });
    if (!result.ok) throw new Error(result.error);
    const after = measure(output);
    expect(Math.abs(after.inputI - DEFAULT_LOUDNESS.target)).toBeLessThanOrEqual(1);
    expect(after.inputI).toBeLessThan(DEFAULT_LOUDNESS.target - 0.5);
    expect(after.inputTp).toBeLessThanOrEqual(DEFAULT_LOUDNESS.truePeak);
    expect(result.value.mix).toEqual({
      measured: { integrated: before, truePeak: peakBefore },
      gainDb: expect.any(Number) as number,
      ceilingDbtp: -2,
      keep: "speech",
      encodes: 1,
    });
    // The gain lands the mix 0.45 LU inside the window's edge (issue #1124), paying what the limiter takes: no further.
    expect(after.inputI).toBeLessThanOrEqual(DEFAULT_LOUDNESS.target - 0.2);
  });

  /**
   * The #1124 comment's lavfi fixture: band-passed pink noise syllables (4 Hz envelope, 2.2 s talk, 0.8 s pause), 2 kHz
   * high-passed clicks every 0.15 s inside the talk at `clicks`, a 196 Hz bed at 0.01; AAC 192k in an MP4.
   */
  function getClickySpeech(clicks: number, seconds = 12): string {
    return (
      `anoisesrc=d=${seconds}:c=pink:r=48000:a=0.5:seed=11,bandpass=f=700:width_type=o:w=2,` +
      `volume='if(lt(mod(t,3),2.2),0.15+0.85*pow(abs(sin(PI*4*t)),3),0.003)':eval=frame,aformat=channel_layouts=stereo[s];` +
      `anoisesrc=d=${seconds}:c=white:r=48000:a=1:seed=3,highpass=f=2000,volume='${clicks}*if(lt(mod(t,0.15),0.006)*lt(mod(t,3),2.2),1,0)':eval=frame,aformat=channel_layouts=stereo[p];` +
      `sine=frequency=196:duration=${seconds}:sample_rate=48000,volume=0.01,aformat=channel_layouts=stereo[m];[s][p][m]amix=inputs=3:normalize=0`
    );
  }

  // On 0.12.0 the 0.6 and 1.0 fixtures failed after 4 encodes; on 0.13.0 they took 3 and 4 (the issue's comment).
  it.each([0.6, 0.75, 1.0])(
    "lands high-crest clicky speech (clicks %s) inside -14 ± 1 LUFS and under -1 dBTP in at most two encodes with keep speech (issue #1124)",
    async (clicks) => {
      const renderFile = makeRender(getClickySpeech(clicks), { preset: "ultrafast" }, 12);
      const { output, result } = await finish(renderFile, { ...KEEP_SPEECH, attempts: 2 }, undefined, 12);
      if (!result.ok) throw new Error(`clicks ${clicks}: ${result.error}`);
      const after = measure(output);
      expect(after.inputTp).toBeLessThanOrEqual(DEFAULT_LOUDNESS.truePeak);
      expect(Math.abs(after.inputI - DEFAULT_LOUDNESS.target)).toBeLessThanOrEqual(1);
      expect(result.value.mix?.encodes).toBeLessThanOrEqual(2);
      expect(result.value.loudness?.warning).toBeNull();
    },
    120_000,
  );

  it("finishes a near miss inside warnTolerance with a warning naming both values, and fails it without the band (issue #1124)", async () => {
    const source = join(dir, "near.wav");
    expect(spawnSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", getClickySpeech(0.75, 6), "-c:a", "pcm_f32le", source]).status).toBe(0);
    const finishNear = async (mixLoudness: MixLoudnessTarget) => {
      // The sound is brought to keep speech's window; the finished film is then held to a stricter target.
      const prepared = await mixFootage(KEEP_SPEECH, { mixSource: source, output: join(dir, "near.m4a") }, { log: (line) => lines.push(line) });
      if (!prepared.ok || prepared.value === null) throw new Error(prepared.ok ? "a silent mix" : prepared.error);
      const renderFile = makeRender("anullsrc=r=48000:cl=stereo:d=6", { preset: "ultrafast" });
      const output = join(dir, "near.mp4");
      return finishFootage({ cover: null, mixLoudness }, { renderFile, seconds: 6, coverAt: 0, mix: prepared.value }, { output, log: (line) => lines.push(line) });
    };
    const strict: MixLoudnessTarget = { target: -12.5, truePeak: -1, tolerance: 0.2 };
    const warned = await finishNear({ ...strict, warnTolerance: 3 });
    if (!warned.ok) throw new Error(warned.error);
    expect(warned.value.loudness?.warning).toMatch(
      /^the finished film .+near\.mp4: the mix measures -1[345]\.\d LUFS integrated, -\d+\.\d dBTP true peak: outside -12\.5 ± 0\.2 LUFS, inside the ± 3 LU near-miss band\.$/,
    );
    expect(lines).toContain(`loudness warning: ${warned.value.loudness?.warning ?? ""}`);
    const failed = await finishNear(strict);
    expect(failed.ok ? "" : failed.error).toMatch(/: integrated -1[345]\.\d LUFS, outside -12\.5 ± 0\.2 LUFS\.$/);
  });

  it("mixes a film's sound before the frames: a mix that misses fails without a render, one that meets gives the encoded sound (issue #1124)", async () => {
    const source = join(dir, "mix.wav");
    expect(spawnSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", getClickySpeech(0.75, 6), "-c:a", "pcm_f32le", source]).status).toBe(0);
    const failed = await mixFootage({ target: -5, truePeak: -9, attempts: 1 }, { mixSource: source, output: join(dir, "mix.m4a") }, { log: (line) => lines.push(line) });
    expect(failed.ok).toBe(false);
    expect(existsSync(join(dir, "mix.m4a"))).toBe(false);
    const prepared = await mixFootage(KEEP_SPEECH, { mixSource: source, output: join(dir, "mix.m4a") }, { log: (line) => lines.push(line) });
    if (!prepared.ok || prepared.value === null) throw new Error(prepared.ok ? "a silent mix" : prepared.error);
    // The final pass muxes the prepared sound under the picture and ignores the render's own.
    const renderFile = makeRender("anullsrc=r=48000:cl=stereo:d=6", { preset: "ultrafast" });
    const output = join(dir, "film.mp4");
    const result = await finishFootage({ cover: null, mixLoudness: KEEP_SPEECH }, { renderFile, seconds: 6, coverAt: 0, mix: prepared.value }, { output, log: (line) => lines.push(line) });
    if (!result.ok) throw new Error(result.error);
    const after = measure(output);
    expect(Math.abs(after.inputI - DEFAULT_LOUDNESS.target)).toBeLessThanOrEqual(1);
    expect(after.inputTp).toBeLessThanOrEqual(DEFAULT_LOUDNESS.truePeak);
    expect(result.value.mix).toEqual(prepared.value.mix);
    expect(lines.some((line) => line.startsWith("finish: picture copied, sound re-encoded"))).toBe(true);
  });
});
