import { describe, expect, it } from "vitest";

import {
  buildLoudnessArgs,
  buildLoudnessMeasureArgs,
  buildMixArgs,
  DEFAULT_LOUDNESS,
  findLoudnessProblems,
  formatDb,
  getBestGainProbe,
  getFirstMixCeiling,
  getLoudnessFilter,
  getLoudnessVerdict,
  getMixAim,
  getMixAttempts,
  getMixFilter,
  getMixGain,
  getMixTolerance,
  getNextGainProbe,
  getNextMixCeiling,
  isSilent,
  MIX_AIM_EDGE_MARGIN,
  MIX_ATTEMPTS,
  MIX_ENCODE_HEADROOM,
  MIX_GAIN_PROBES,
  MIX_LOUDNESS_TOLERANCE,
  readLoudnessMeasurement,
  solveMixGain,
  type MixAttempt,
  type MixTry,
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

  it("starts the ceiling one encode's headroom under the limit, never under the limiter's floor of -24 dB", () => {
    expect(getFirstMixCeiling(TARGET)).toBe(-2);
    expect(MIX_ENCODE_HEADROOM).toBe(1);
    expect(getFirstMixCeiling({ target: -14, truePeak: -30 })).toBe(-24);
  });

  it("lowers the ceiling only by the encode's true peak excess plus a margin, whatever the loudness (issue #1124)", () => {
    expect(getNextMixCeiling(-2, { integrated: -15.6, truePeak: -0.2 }, TARGET)).toBe(-3.1);
    expect(getNextMixCeiling(-2, { integrated: -12, truePeak: -0.2 }, TARGET)).toBe(-3.1);
    expect(getNextMixCeiling(-2, { integrated: -15.6, truePeak: -1.3 }, TARGET)).toBe(-2);
    expect(getNextMixCeiling(-23, { integrated: -14, truePeak: 5 }, TARGET)).toBe(-24);
  });

  it("builds gain, a limiter at 4x the film's rate without auto level and with its delay compensated, the film's rate, then a 16 kHz low-pass", () => {
    expect(getMixFilter({ gainDb: 1.88, ceilingDbtp: -2 })).toBe("volume=1.88dB,aresample=192000,alimiter=limit=0.79433:level=false:latency=true,aresample=48000,lowpass=f=16000");
  });

  it("encodes the sound alone as the finished film carries it, the encoder cut at 16 kHz", () => {
    expect(buildMixArgs({ input: "/b/mix.wav", filter: "volume=1dB", output: "/b/mix.m4a" })).toEqual([
      "-v",
      "error",
      "-y",
      "-i",
      "/b/mix.wav",
      "-vn",
      "-map",
      "0:a:0",
      "-af",
      "volume=1dB",
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      "-cutoff",
      "16000",
      "-ar",
      "48000",
      "-ac",
      "2",
      "/b/mix.m4a",
    ]);
  });

  it("measures the sound through a filter for the uncompressed probes", () => {
    expect(buildLoudnessMeasureArgs("/b/mix.wav", TARGET, "volume=2dB")).toEqual([
      "-hide_banner",
      "-nostats",
      "-i",
      "/b/mix.wav",
      "-vn",
      "-af",
      "volume=2dB,loudnorm=I=-14:TP=-1:LRA=11:print_format=json",
      "-f",
      "null",
      "-",
    ]);
  });

  it("encodes at most four times unless the target says", () => {
    expect(getMixAttempts(TARGET)).toBe(MIX_ATTEMPTS);
    expect(MIX_ATTEMPTS).toBe(4);
    expect(getMixAttempts({ ...TARGET, attempts: 2 })).toBe(2);
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

  it("holds the gate to the target's own tolerance", () => {
    expect(getMixTolerance(KEEP)).toBe(MIX_LOUDNESS_TOLERANCE);
    expect(findLoudnessProblems({ integrated: -15.5, truePeak: -1.2 }, { ...KEEP, tolerance: 2 })).toEqual([]);
    expect(findLoudnessProblems({ integrated: -14.6, truePeak: -1.2 }, { ...KEEP, tolerance: 0.5 })).toEqual(["integrated -14.6 LUFS, outside -14.0 ± 0.5 LUFS"]);
  });
});

/** A probe of the gain at a -2 dBTP ceiling. */
function probe(gainDb: number, integrated: number): MixTry {
  return { attempt: { gainDb, ceilingDbtp: -2 }, measured: { integrated, truePeak: -2 } };
}

describe("the gain solved at a fixed ceiling on uncompressed probes (issue #1124)", () => {
  const TARGET = { target: -14, truePeak: -1 };
  const KEEP = { target: -14, truePeak: -1, keep: "speech" as const };

  it("aims at the target within 0.15 LU, or with keep speech moves no mix 0.1 LU inside the window and aims a miss 0.45 LU inside its edge", () => {
    expect(getMixAim(-14.1, TARGET)).toEqual({ aim: -14, isMet: true });
    expect(getMixAim(-14.3, TARGET)).toEqual({ aim: -14, isMet: false });
    expect(getMixAim(-14.9, KEEP)).toEqual({ aim: -14.9, isMet: true });
    expect(getMixAim(-13.1, KEEP)).toEqual({ aim: -13.1, isMet: true });
    expect(getMixAim(-14.95, KEEP).isMet).toBe(false);
    expect(getMixAim(-15.6, KEEP)).toEqual({ aim: -14.55, isMet: false });
    expect(getMixAim(-12.5, KEEP)).toEqual({ aim: -13.45, isMet: false });
    expect(getMixAim(-14.3, { ...KEEP, tolerance: 0.2 })).toEqual({ aim: -14.1, isMet: false });
    expect(getMixAim(-14.1, { ...KEEP, tolerance: 0.2 }).isMet).toBe(true);
    expect(MIX_AIM_EDGE_MARGIN).toBe(0.45);
  });

  it("steps by the miss from one probe, then along the secant of the last two", () => {
    expect(getNextGainProbe([probe(2, -15.5)], TARGET)).toBe(3.5);
    // 2 dB moved the mix 1 LU: half a LU per dB, so the last 0.5 LU needs 1 dB more.
    expect(getNextGainProbe([probe(2, -15.5), probe(4, -14.5)], TARGET)).toBe(5);
  });

  it("steps by the miss when the limiter takes back what the gain added, so a falling slope cannot run away", () => {
    // The issue's lavfi fixture at A = 0.75: +3 dB made the mix 3 LU quieter.
    expect(getNextGainProbe([probe(0, -15.8), probe(3, -18.9)], KEEP)).toBe(7.35);
  });

  it("stops when the last probe meets its aim or would repeat a gain", () => {
    expect(getNextGainProbe([probe(1, -14.05)], TARGET)).toBeNull();
    expect(getNextGainProbe([probe(0, -14.8)], KEEP)).toBeNull();
    expect(getNextGainProbe([probe(1, -15), probe(2, -15)], TARGET)).toBe(3);
    expect(getNextGainProbe([probe(4, -14), probe(2, -15.2)], TARGET)).toBeNull();
  });

  it("aims the probes by what the encode added to the last one", () => {
    // The encode measured 0.4 LU under its probe: the probes now aim 0.4 LU higher.
    expect(getNextGainProbe([probe(2, -14.1)], TARGET, -0.4)).toBe(2.5);
  });

  it("never probes beyond 30 dB either way", () => {
    expect(getNextGainProbe([probe(25, -60)], TARGET)).toBe(30);
    expect(getNextGainProbe([probe(-25, 30)], TARGET)).toBe(-30);
  });

  it("fails loudly without a probe", () => {
    expect(() => getNextGainProbe([], TARGET)).toThrow("getNextGainProbe: no probe of the mix to correct.");
    expect(() => getBestGainProbe([], TARGET)).toThrow("getBestGainProbe: no probe of the mix.");
  });

  it("keeps the probe closest to its aim", () => {
    expect(getBestGainProbe([probe(0, -15.8), probe(3, -18.9), probe(7, -15.2)], KEEP).attempt.gainDb).toBe(7);
    expect(getBestGainProbe([probe(0, -15.8), probe(3, -14.6)], KEEP).attempt.gainDb).toBe(3);
  });

  it("solves a mix that is not monotone in the gain within the probe budget", async () => {
    // A limiter that crushes clicks: loudness falls from 0 to 6 dB of gain and rises after it.
    const curve = (gainDb: number): number => (gainDb <= 6 ? -15.8 - 0.55 * gainDb : -19.1 + 0.9 * (gainDb - 6));
    const measured: MixAttempt[] = [];
    const solved = await solveMixGain({
      ceilingDbtp: -2,
      startGainDb: 0,
      target: KEEP,
      shift: 0,
      measure: (attempt) => {
        measured.push(attempt);
        return Promise.resolve({ integrated: curve(attempt.gainDb), truePeak: -2 });
      },
    });
    expect(measured.length).toBeLessThanOrEqual(MIX_GAIN_PROBES);
    expect(measured.every((attempt) => attempt.ceilingDbtp === -2)).toBe(true);
    expect(getMixAim(solved.best.measured.integrated, KEEP).isMet).toBe(true);
  });

  it("takes one probe when the mix already meets its aim", async () => {
    const solved = await solveMixGain({ ceilingDbtp: -2, startGainDb: 0, target: KEEP, shift: 0, measure: () => Promise.resolve({ integrated: -14.4, truePeak: -2.1 }) });
    expect(solved.probes).toHaveLength(1);
    expect(solved.best.attempt).toEqual({ gainDb: 0, ceilingDbtp: -2 });
  });
});

describe("the near-miss band (issue #1124)", () => {
  const BAND = { target: -14, truePeak: -1, tolerance: 1, warnTolerance: 1.5 };

  it("passes a mix inside the tolerance", () => {
    expect(getLoudnessVerdict({ integrated: -14.9, truePeak: -1.2 }, BAND)).toEqual({ kind: "pass" });
  });

  it("warns, naming both values, when only the integrated loudness misses by at most warnTolerance", () => {
    expect(getLoudnessVerdict({ integrated: -15.4, truePeak: -1.3 }, BAND)).toEqual({
      kind: "warn",
      warning: "the mix measures -15.4 LUFS integrated, -1.3 dBTP true peak: outside -14.0 ± 1 LUFS, inside the ± 1.5 LU near-miss band.",
    });
    expect(getLoudnessVerdict({ integrated: -12.5, truePeak: -2 }, BAND).kind).toBe("warn");
  });

  it("fails past the band, and never relaxes the true peak limit", () => {
    expect(getLoudnessVerdict({ integrated: -15.6, truePeak: -1.3 }, BAND)).toEqual({ kind: "fail", problems: ["integrated -15.6 LUFS, outside -14.0 ± 1 LUFS"] });
    expect(getLoudnessVerdict({ integrated: -15.2, truePeak: -0.9 }, BAND)).toEqual({
      kind: "fail",
      problems: ["true peak -0.9 dBTP, over the -1.0 dBTP limit", "integrated -15.2 LUFS, outside -14.0 ± 1 LUFS"],
    });
  });

  it("fails every miss without a band", () => {
    expect(getLoudnessVerdict({ integrated: -15.4, truePeak: -1.3 }, { target: -14, truePeak: -1 }).kind).toBe("fail");
  });
});
