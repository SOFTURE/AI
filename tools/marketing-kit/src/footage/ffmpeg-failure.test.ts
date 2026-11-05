import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { FfmpegFailure } from "./ffmpeg-command.js";
import { buildFfmpegFailureScript, writeFfmpegFailure, type FfmpegFailureInput } from "./ffmpeg-failure.js";
import { runFfmpeg, withFfmpegFailureReporting } from "./process.js";

const hasFfmpeg = spawnSync("ffmpeg", ["-version"]).status === 0 && spawnSync("ffprobe", ["-version"]).status === 0;

const failure: FfmpegFailure = {
  step: "The footage draft",
  args: ["-progress", "pipe:1", "-nostats", "-i", "clip.mp4", "-filter_complex", "[0:v]scale=64:64[a];[a]fps=30[v]", "-map", "[v]", "out.mp4"],
  cwd: "/build/my draft",
  code: 1,
  signal: null,
  stderr: ["first", "second"],
  inputs: ["/build/my draft/clip.mp4"],
};

describe("buildFfmpegFailureScript", () => {
  it("runs the same command in the same folder, the graph read from filtergraph.txt by the version's option", () => {
    const script = buildFfmpegFailureScript(failure);
    expect(script.split("\n")[0]).toBe("#!/bin/sh");
    expect(script).toContain("# The footage draft: ffmpeg ended with code 1 (signal -).");
    expect(script).toContain("cd '/build/my draft' || exit 1");
    expect(script).toContain("graph_option=-/filter_complex\n");
    expect(script).toContain("[0-6].* | 7.0) graph_option=-filter_complex_script ;;");
    expect(script).toContain(`exec ffmpeg -progress pipe:1 -nostats -i clip.mp4 "$graph_option" "$here/filtergraph.txt" -map '[v]' out.mp4\n`);
  });

  it("asks for no graph option when the command has no filter graph", () => {
    const script = buildFfmpegFailureScript({ ...failure, args: ["-i", "clip.mp4", "out.mp3"] });
    expect(script).not.toContain("graph_option");
    expect(script).toContain("exec ffmpeg -i clip.mp4 out.mp3\n");
  });
});

describe.skipIf(!hasFfmpeg)("an ffmpeg failure with ffmpeg", () => {
  let dir = "";
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "ffmpeg-failure-"));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  /** stderr's non-empty lines without the pointers ffmpeg prints (`[out#0/mp4 @ 0x55ca533fe1c0]`), which differ per run. */
  const toLines = (text: string): string[] => text.split("\n").filter((line) => line.trim().length > 0).map((line) => line.replace(/ @ 0x[0-9a-f]+/g, ""));

  const sh = (script: string): { status: number | null; stderr: string } => {
    const result = spawnSync("sh", [script], { encoding: "utf8" });
    return { status: result.status, stderr: result.stderr };
  };

  it("hands the hook exactly what ran, logs the command and throws the same text as before", async () => {
    writeFileSync(join(dir, "clip.txt"), "not a video");
    const failures: FfmpegFailure[] = [];
    const lines: string[] = [];
    const args = ["-v", "error", "-y", "-i", "clip.txt", "-f", "lavfi", "-i", "anullsrc", "-filter_complex", "[0:v]null[v]", "-map", "[v]", "out.mp4"];
    const run = withFfmpegFailureReporting({ onFailure: (found) => void failures.push(found), log: (line) => lines.push(line) }, () => runFfmpeg("A broken step", args, { cwd: dir }));
    await expect(run).rejects.toThrow(/^A broken step: ffmpeg ended with code \d+ \(signal -\): .*clip\.txt.*\.$/);
    expect(failures).toHaveLength(1);
    const [found] = failures;
    expect(found).toMatchObject({ step: "A broken step", args: ["-progress", "pipe:1", "-nostats", ...args], cwd: dir, signal: null, inputs: [join(dir, "clip.txt"), "anullsrc"] });
    expect(found?.code).toBeGreaterThan(0);
    expect(found?.stderr.join("\n")).toContain("clip.txt");
    expect(lines).toEqual([`ffmpeg failed: A broken step, in ${dir}: ffmpeg -progress pipe:1 -nostats -v error -y -i clip.txt -f lavfi -i anullsrc -filter_complex '[0:v]null[v]' -map '[v]' out.mp4`]);
  });

  it("writes a folder whose command.sh, run there, fails the same way and reads the graph from filtergraph.txt", async () => {
    const kept = join(dir, "kept");
    // A two-chain graph that parses, and a map of a label it does not have: the failure comes after the graph is read.
    const args = ["-v", "error", "-y", "-f", "lavfi", "-i", "color=c=red:s=64x64:d=1", "-filter_complex", "[0:v]scale=32:32[a];[a]fps=30[v]", "-map", "[none]", "out.mp4"];
    let found: FfmpegFailure | null = null;
    const run = runFfmpeg("A graph step", args, {
      cwd: dir,
      onFailure: async (failure) => {
        found = failure;
        await writeFfmpegFailure(kept, failure);
      },
    });
    await expect(run).rejects.toThrow("A graph step: ffmpeg ended with code");
    if (found === null) throw new Error("the hook was not called");
    const failure: FfmpegFailure = found;
    expect(readFileSync(join(kept, "filtergraph.txt"), "utf8")).toBe("[0:v]scale=32:32[a];\n[a]fps=30[v]\n");
    expect(readFileSync(join(kept, "stderr.log"), "utf8")).toBe(failure.stderr.map((line) => `${line}\n`).join(""));
    expect(JSON.parse(readFileSync(join(kept, "inputs.json"), "utf8"))).toEqual([{ input: "color=c=red:s=64x64:d=1", kind: "lavfi" }]);
    expect(statSync(join(kept, "command.sh")).mode & 0o111).not.toBe(0);
    const rerun = sh(join(kept, "command.sh"));
    expect(rerun.status).toBe(failure.code);
    expect(failure.stderr.join("\n")).toContain("Output with label 'none' does not exist");
    expect(toLines(rerun.stderr)).toEqual(toLines(failure.stderr.join("\n")));
  });

  it("probes every file input, and names one it cannot read", async () => {
    const clip = join(dir, "clip.mp4");
    const made = spawnSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "color=c=blue:s=64x64:d=1", "-c:v", "libx264", "-pix_fmt", "yuv420p", clip]);
    if (made.status !== 0) throw new Error(made.stderr.toString());
    const kept = join(dir, "kept");
    const written = await writeFfmpegFailure(kept, { ...failure, args: ["-i", clip, "out.mp4"], cwd: dir, inputs: [clip, join(dir, "gone.mp4")] });
    expect(written).toEqual([join(kept, "command.sh"), join(kept, "stderr.log"), join(kept, "inputs.json")]);
    const inputs = JSON.parse(readFileSync(join(kept, "inputs.json"), "utf8")) as FfmpegFailureInput[];
    expect(inputs.map((input) => input.kind)).toEqual(["probed", "probe-failed"]);
    expect(inputs[0]).toMatchObject({ input: clip, json: { streams: [{ codec_name: "h264" }] } });
    expect(inputs[1]).toMatchObject({ input: join(dir, "gone.mp4") });
  });
});
