import { describe, expect, it } from "vitest";

import {
  buildLoudnessArgs,
  buildLoudnessMeasureArgs,
  buildMixArgs,
  DEFAULT_LOUDNESS,
  findLoudnessProblems,
  formatDb,
  getFirstMixAttempt,
  getLoudnessFilter,
  getMixFilter,
  getMixGain,
  getMixTolerance,
  getNextMixAttempt,
  isSilent,
  MIX_ENCODE_HEADROOM,
  MIX_LOUDNESS_TOLERANCE,
  readLoudnessMeasurement,
} from "./loudness.js";

const STDERR = [
  "Input #0, mp3, from 'speech.mp3':",
  "[Parsed_loudnorm_0 @ 0x563a85a40d40] ",
  "{",
  '\t"input_i" : "-31.25",',
  '\t"input_tp" : "-12.52",',
  '\t"input_lra" : "6.10",',
  '\t"input_thresh" : "-41.80",',
  '\t"output_i" : "-14.05",',
  '\t"output_tp" : "-1.00",',
  '\t"output_lra" : "5.20",',
  '\t"output_thresh" : "-24.50",',
  '\t"normalization_type" : "dynamic",',
  '\t"target_offset" : "0.05"',
  "}",
].join("\n");

describe("buildLoudnessMeasureArgs", () => {
  it("measures the sound against the target, skips any picture and writes nothing", () => {
    expect(buildLoudnessMeasureArgs("/a/speech.raw.mp3", DEFAULT_LOUDNESS)).toEqual([
      "-hide_banner",
      "-nostats",
      "-i",
      "/a/speech.raw.mp3",
      "-vn",
      "-af",
      "loudnorm=I=-14:TP=-1:LRA=11:print_format=json",
      "-f",
      "null",
      "-",
    ]);
  });
});

describe("readLoudnessMeasurement", () => {
  it("reads the measurement loudnorm prints", () => {
    expect(readLoudnessMeasurement(STDERR)).toEqual({ inputI: -31.25, inputTp: -12.52, inputLra: 6.1, inputThresh: -41.8, targetOffset: 0.05 });
  });

  it("reads silence as minus infinity", () => {
    const silent = readLoudnessMeasurement(STDERR.replace('"-31.25"', '"-inf"').replace('"-12.52"', '"-inf"'));
    expect(silent?.inputI).toBe(-Infinity);
    expect(silent !== null && isSilent(silent)).toBe(true);
  });

  it("reads a silent track's infinite offset, as ffmpeg prints it for digital silence", () => {
    const silent = readLoudnessMeasurement(STDERR.replace('"-31.25"', '"-inf"').replace('"-12.52"', '"-inf"').replace('"0.05"', '"inf"'));
    expect(silent?.targetOffset).toBe(Infinity);
    expect(silent !== null && isSilent(silent)).toBe(true);
  });

  it("answers null without a measurement or with a broken one", () => {
    expect(readLoudnessMeasurement("Error opening input")).toBeNull();
    expect(readLoudnessMeasurement(STDERR.replace('"-31.25"', '"loud"'))).toBeNull();
    expect(readLoudnessMeasurement('{ "input_i" : "-20" }')).toBeNull();
  });
});

describe("isSilent", () => {
  it("tells a quiet track from silence", () => {
    const quiet = { inputI: -48, inputTp: -40, inputLra: 0, inputThresh: -58, targetOffset: 0 };
    expect(isSilent(quiet)).toBe(false);
    expect(isSilent({ ...quiet, inputI: -71 })).toBe(true);
  });
});

describe("buildLoudnessArgs", () => {
  it("applies one linear gain from the measurement and resamples to 48 kHz", () => {
    const measurement = readLoudnessMeasurement(STDERR);
    if (measurement === null) throw new Error("no measurement");
    const args = buildLoudnessArgs({ input: "/a/raw.mp3", measurement, target: { target: -16, truePeak: -1.5 }, output: "/a/speech.mp3" });
    expect(args[args.indexOf("-af") + 1]).toBe(
      "loudnorm=I=-16:TP=-1.5:LRA=11:measured_I=-31.25:measured_TP=-12.52:measured_LRA=6.1:measured_thresh=-41.8:offset=0.05:linear=true,aresample=48000",
    );
    expect(args.slice(args.indexOf("-ar"), args.indexOf("-ar") + 2)).toEqual(["-ar", "48000"]);
    expect(args.slice(3, 5)).toEqual(["-i", "/a/raw.mp3"]);
    expect(args.at(-1)).toBe("/a/speech.mp3");
  });
});

describe("getLoudnessFilter", () => {
  it("is the second pass's linear gain, resampled to 48 kHz", () => {
    const measurement = { inputI: -25.4, inputTp: -1.6, inputLra: 4.2, inputThresh: -35.9, targetOffset: -0.2 };
    expect(getLoudnessFilter(measurement, DEFAULT_LOUDNESS)).toBe(
      "loudnorm=I=-14:TP=-1:LRA=11:measured_I=-25.4:measured_TP=-1.6:measured_LRA=4.2:measured_thresh=-35.9:offset=-0.2:linear=true,aresample=48000",
    );
  });
});

describe("the mix's last stage (issue #1079)", () => {
  const TARGET = { target: -14, truePeak: -1 };

  it("starts with the gain to the target and the ceiling one encode's headroom under the limit", () => {
    expect(getFirstMixAttempt({ inputI: -16.12 }, TARGET)).toEqual({ gainDb: 2.12, ceilingDbtp: -2 });
    expect(MIX_ENCODE_HEADROOM).toBe(1);
  });

  it("lowers the ceiling by the overshoot plus a margin and corrects the gain by the integrated miss", () => {
    expect(getNextMixAttempt({ gainDb: -1.71, ceilingDbtp: -2 }, { integrated: -14.74, truePeak: 0.89 }, TARGET)).toEqual({ gainDb: -0.97, ceilingDbtp: -4.19 });
  });

  it("keeps the ceiling when only the integrated loudness missed", () => {
    expect(getNextMixAttempt({ gainDb: 3, ceilingDbtp: -2 }, { integrated: -15.5, truePeak: -1.5 }, TARGET)).toEqual({ gainDb: 4.5, ceilingDbtp: -2 });
  });

  it("never lowers the ceiling under the limiter's floor of -24 dB", () => {
    expect(getNextMixAttempt({ gainDb: 0, ceilingDbtp: -23 }, { integrated: -14, truePeak: 5 }, TARGET).ceilingDbtp).toBe(-24);
    expect(getFirstMixAttempt({ inputI: -14 }, { target: -14, truePeak: -30 }).ceilingDbtp).toBe(-24);
  });

  it("builds gain, a limiter at 4x the film's rate without auto level and with its delay compensated, then the film's rate", () => {
    expect(getMixFilter({ gainDb: 1.88, ceilingDbtp: -2 })).toBe("volume=1.88dB,aresample=192000,alimiter=limit=0.79433:level=false:latency=true,aresample=48000");
  });

  it("encodes the sound alone as the finished film carries it", () => {
    expect(buildMixArgs({ input: "/b/render.mp4", filter: "volume=1dB", output: "/b/mix.m4a" })).toEqual([
      "-v",
      "error",
      "-y",
      "-i",
      "/b/render.mp4",
      "-vn",
      "-map",
      "0:a:0",
      "-af",
      "volume=1dB",
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      "-ar",
      "48000",
      "-ac",
      "2",
      "/b/mix.m4a",
    ]);
  });

  it("finds a true peak over the limit and an integrated loudness outside one LU, naming both values", () => {
    expect(findLoudnessProblems({ integrated: -14.8, truePeak: 0.1 }, TARGET)).toEqual(["true peak +0.1 dBTP, over the -1.0 dBTP limit"]);
    expect(findLoudnessProblems({ integrated: -15.2, truePeak: -1.2 }, TARGET)).toEqual(["integrated -15.2 LUFS, outside -14.0 ± 1 LUFS"]);
    expect(findLoudnessProblems({ integrated: -16, truePeak: -0.5 }, TARGET)).toHaveLength(2);
  });

  it("accepts the limit and both edges of the tolerance", () => {
    expect(findLoudnessProblems({ integrated: -15, truePeak: -1 }, TARGET)).toEqual([]);
    expect(findLoudnessProblems({ integrated: -13, truePeak: -3 }, TARGET)).toEqual([]);
  });

  it("formats levels with one decimal and a sign over zero", () => {
    expect(formatDb(0.1)).toBe("+0.1");
    expect(formatDb(-14)).toBe("-14.0");
    expect(formatDb(-0.04)).toBe("0.0");
    expect(formatDb(0.04)).toBe("0.0");
  });
});

describe("the mix's gain that keeps the speech (issue #1085)", () => {
  const KEEP = { target: -14, truePeak: -1, keep: "speech" as const };

  it("applies no gain while the mix measures inside the target ± the tolerance, edges included", () => {
    expect(getMixGain(-14.6, KEEP)).toBe(0);
    expect(getMixGain(-13.3, KEEP)).toBe(0);
    expect(getMixGain(-15, KEEP)).toBe(0);
    expect(getMixGain(-13, KEEP)).toBe(0);
    expect(getFirstMixAttempt({ inputI: -14.6 }, KEEP)).toEqual({ gainDb: 0, ceilingDbtp: -2 });
  });

  it("brings a mix outside the window to its nearest edge, aimed 0.2 LU inside", () => {
    expect(getMixGain(-15.5, KEEP)).toBe(0.7);
    expect(getMixGain(-11.5, KEEP)).toBe(-1.7);
    expect(getMixGain(-17, { ...KEEP, tolerance: 2 })).toBe(1.2);
    expect(getMixGain(-14.5, { ...KEEP, tolerance: 0.3 })).toBe(0.35);
  });

  it("keeps today's gain to the target without the option", () => {
    expect(getMixGain(-14.6, { target: -14, truePeak: -1 })).toBe(0.6);
    expect(getMixGain(-14.6, { target: -14, truePeak: -1, keep: "loudness" })).toBe(0.6);
  });

  it("retries without moving the gain while the encoded mix stays inside the window, lowering only the ceiling", () => {
    expect(getNextMixAttempt({ gainDb: 0, ceilingDbtp: -2 }, { integrated: -14.7, truePeak: -0.4 }, KEEP)).toEqual({ gainDb: 0, ceilingDbtp: -2.9 });
    expect(getNextMixAttempt({ gainDb: 0.7, ceilingDbtp: -2 }, { integrated: -15.1, truePeak: -1.5 }, KEEP)).toEqual({ gainDb: 1, ceilingDbtp: -2 });
  });

  it("holds the gate to the target's own tolerance", () => {
    expect(getMixTolerance(KEEP)).toBe(MIX_LOUDNESS_TOLERANCE);
    expect(findLoudnessProblems({ integrated: -15.5, truePeak: -1.2 }, { ...KEEP, tolerance: 2 })).toEqual([]);
    expect(findLoudnessProblems({ integrated: -14.6, truePeak: -1.2 }, { ...KEEP, tolerance: 0.5 })).toEqual(["integrated -14.6 LUFS, outside -14.0 ± 0.5 LUFS"]);
  });
});
