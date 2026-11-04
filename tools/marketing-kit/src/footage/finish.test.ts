import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { DEFAULT_LOUDNESS, readLoudnessMeasurement, type LoudnessMeasurement } from "./loudness.js";
import { finishFootage } from "./pipeline.js";

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
  function makeRender(audio: string): string {
    const file = join(dir, "render.mp4");
    const made = spawnSync("ffmpeg", [
      "-v",
      "error",
      "-y",
      "-f",
      "lavfi",
      "-i",
      "color=c=black:s=180x320:r=30:d=6",
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
      "-profile:v",
      "high",
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

  async function finish(renderFile: string, mixLoudness?: null) {
    const output = join(dir, "film.mp4");
    const result = await finishFootage({ cover: null, ...(mixLoudness === undefined ? {} : { mixLoudness }) }, { renderFile, seconds: 6, coverAt: 0 }, { output, log: (line) => lines.push(line) });
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
    expect(lines).toContain(`loudness: the film's mix measured ${before.toFixed(1)} LUFS, normalized to -14 LUFS (true peak -1 dBTP).`);
    expect(lines.some((line) => line.startsWith("finish: picture copied, sound re-encoded"))).toBe(true);
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
    expect(Math.abs(measure(output).inputI - before)).toBeLessThan(0.1);
    expect(lines.some((line) => line.startsWith("loudness:"))).toBe(false);
  });
});
