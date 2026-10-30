import { describe, expect, it } from "vitest";

import { buildLoudnessArgs, buildLoudnessMeasureArgs, DEFAULT_LOUDNESS, isSilent, readLoudnessMeasurement } from "./loudness.js";

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
  it("measures the track against the target and writes nothing", () => {
    expect(buildLoudnessMeasureArgs("/a/speech.raw.mp3", DEFAULT_LOUDNESS)).toEqual([
      "-hide_banner",
      "-nostats",
      "-i",
      "/a/speech.raw.mp3",
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
