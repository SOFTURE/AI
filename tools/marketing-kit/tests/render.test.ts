import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { prepareFixture } from "../examples/fixture/prepare.js";

/**
 * The whole pipeline on the fixture film: start the fixture app, record it frame by frame, compose
 * and render a draft MP4 with hyperframes, write the post copy.
 *
 * Opt-in (`MARKETING_KIT_RENDER=1`): it needs ffmpeg, a Chromium for Playwright
 * (`PLAYWRIGHT_CHROMIUM_PATH` or Playwright's own) and a Chrome for hyperframes
 * (`HYPERFRAMES_BROWSER_PATH` or its first-run download), and it takes about a minute.
 * `MARKETING_KIT_KEEP=1` keeps the output folder for a look at the frames.
 */
const isEnabled = process.env.MARKETING_KIT_RENDER === "1";
const PACKAGE_DIR = join(import.meta.dirname, "..");
const TSX = join(PACKAGE_DIR, "..", "..", "node_modules", ".bin", "tsx");

describe.runIf(isEnabled)("softure-marketing all on the fixture film", () => {
  const target = mkdtempSync(join(tmpdir(), "marketing-kit-fixture-"));
  afterAll(() => {
    if (process.env.MARKETING_KIT_KEEP === "1") console.log(`fixture output kept in ${target}`);
    else rmSync(target, { recursive: true, force: true });
  });

  it("renders a 1080×1920 draft MP4 and the post copy", () => {
    const { config } = prepareFixture(target);
    const result = spawnSync(TSX, [join(PACKAGE_DIR, "src", "cli", "main.ts"), "all", "fixture-tour", `--config=${config}`, "--quality=draft"], {
      encoding: "utf8",
    });
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);

    const video = join(target, "out", "fixture-tour", "fixture-tour.mp4");
    const probe = JSON.parse(
      execFileSync("ffprobe", ["-v", "error", "-show_entries", "stream=codec_type,width,height:format=duration", "-of", "json", video], { encoding: "utf8" }),
    ) as { streams: { codec_type: string; width?: number; height?: number }[]; format: { duration: string } };
    const videoStream = probe.streams.find((stream) => stream.codec_type === "video");
    expect([videoStream?.width, videoStream?.height]).toEqual([1080, 1920]);
    expect(probe.streams.some((stream) => stream.codec_type === "audio")).toBe(true);
    // The composition's length is printed by the CLI ("(12.3 s, 1080×1920 ...").
    const printed = Number(/\((\d+(?:\.\d+)?) s, 1080×1920/.exec(result.stdout)?.[1]);
    expect(Math.abs(Number(probe.format.duration) - printed)).toBeLessThan(0.5);

    const posts = readFileSync(join(target, "out", "fixture-tour", "posts.md"), "utf8");
    expect(posts).toContain("Link for the bio: https://example.com/calculator?z=ig-01");
  }, 600_000);
});
