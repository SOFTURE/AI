import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { crossfadeArgs } from "../src/compose/timeline.js";

const hasFfmpeg = spawnSync("ffmpeg", ["-version"]).status === 0 && spawnSync("ffprobe", ["-version"]).status === 0;

/** The transition clip as ffmpeg really builds it: its length is part of every time after the opening. */
describe.runIf(hasFfmpeg)("the transition clip", () => {
  const dir = mkdtempSync(join(tmpdir(), "marketing-kit-transition-"));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));
  const stills = ["red", "green", "blue", "white", "black"].map((color) => {
    const path = join(dir, `${color}.jpg`);
    execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", `color=${color}:s=64x128`, "-frames:v", "1", path]);
    return path;
  });

  it.each([2, 5])("lasts 0.8 s, 24 frames at 30 fps, from %i stills", (count) => {
    const output = join(dir, `t${count}.mp4`);
    execFileSync("ffmpeg", ["-v", "error", "-y", ...crossfadeArgs({ inputs: stills.slice(0, count), fps: 30, seconds: 0.8, output })]);
    const probe = execFileSync("ffprobe", ["-v", "error", "-count_frames", "-show_entries", "stream=nb_read_frames,duration", "-of", "csv=p=0", output], { encoding: "utf8" });
    expect(probe.trim()).toBe("0.800000,24");
  });
});
