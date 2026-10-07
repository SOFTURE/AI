import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { prepareFixture } from "../examples/fixture/prepare.js";

/**
 * The whole pipeline on the fixture film: start the fixture app, record it frame by frame, compose
 * and render a draft MP4 with hyperframes, write the post copy; then record the film's JSON twin
 * (beat actions instead of the scene module) and compare the two recording logs; then record and render the same
 * scene as a desktop film in a browser window (16:9).
 *
 * Opt-in (`MARKETING_KIT_RENDER=1`): it needs ffmpeg, a Chromium for Playwright
 * (`PLAYWRIGHT_CHROMIUM_PATH` or Playwright's own) and a Chrome for hyperframes
 * (`HYPERFRAMES_BROWSER_PATH` or its first-run download), and it takes about a minute.
 * `MARKETING_KIT_KEEP=1` keeps the output folder for a look at the frames.
 */
const isEnabled = process.env.MARKETING_KIT_RENDER === "1";
const PACKAGE_DIR = join(import.meta.dirname, "..");
const TSX = join(PACKAGE_DIR, "..", "..", "node_modules", ".bin", "tsx");

interface Probe {
  streams: { codec_type: string; width?: number; height?: number }[];
  format: { duration: string };
}

function probe(video: string): Probe {
  return JSON.parse(
    execFileSync("ffprobe", ["-v", "error", "-show_entries", "stream=codec_type,width,height:format=duration", "-of", "json", video], { encoding: "utf8" }),
  ) as Probe;
}

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
    const phoneProbe = probe(video);
    const videoStream = phoneProbe.streams.find((stream) => stream.codec_type === "video");
    expect([videoStream?.width, videoStream?.height]).toEqual([1080, 1920]);
    expect(phoneProbe.streams.some((stream) => stream.codec_type === "audio")).toBe(true);
    // The composition's length is printed by the CLI ("(12.3 s, 1080×1920 ...").
    const printed = Number(/\((\d+(?:\.\d+)?) s, 1080×1920/.exec(result.stdout)?.[1]);
    expect(Math.abs(Number(phoneProbe.format.duration) - printed)).toBeLessThan(0.5);

    const posts = readFileSync(join(target, "out", "fixture-tour", "posts.md"), "utf8");
    expect(posts).toContain("Link for the bio: https://example.com/calculator?z=ig-01");

    // The same film with its scene as beat actions records the same log: beats, taps, keys, camera,
    // marks, stills and cues, frame for frame.
    const twin = spawnSync(TSX, [join(PACKAGE_DIR, "src", "cli", "main.ts"), "record", "fixture-tour-actions", `--config=${config}`], { encoding: "utf8" });
    expect(twin.status, `${twin.stdout}\n${twin.stderr}`).toBe(0);
    const readLog = (id: string): unknown => JSON.parse(readFileSync(join(target, "build", id, "log.json"), "utf8"));
    expect(readLog("fixture-tour-actions")).toEqual(readLog("fixture-tour"));

    // The same scene recorded in a desktop browser and framed as a browser window in 16:9.
    const desktop = spawnSync(TSX, [join(PACKAGE_DIR, "src", "cli", "main.ts"), "all", "fixture-desktop", `--config=${config}`, "--quality=draft"], {
      encoding: "utf8",
    });
    expect(desktop.status, `${desktop.stdout}\n${desktop.stderr}`).toBe(0);
    const desktopProbe = probe(join(target, "out", "fixture-desktop", "fixture-desktop.mp4"));
    const desktopStream = desktopProbe.streams.find((stream) => stream.codec_type === "video");
    expect([desktopStream?.width, desktopStream?.height]).toEqual([1920, 1080]);
    expect(desktopProbe.streams.some((stream) => stream.codec_type === "audio")).toBe(true);
    const desktopPrinted = Number(/\((\d+(?:\.\d+)?) s, 1920×1080, 16:9\)/.exec(desktop.stdout)?.[1]);
    expect(Math.abs(Number(desktopProbe.format.duration) - desktopPrinted)).toBeLessThan(0.5);
    // The desktop recording clicks where the phone recording taps, sentence for sentence.
    const phoneLog = readLog("fixture-tour") as { beatIds: string[]; taps: unknown[] };
    const desktopLog = readLog("fixture-desktop") as { beatIds: string[]; taps: unknown[] };
    expect(desktopLog.beatIds).toEqual(phoneLog.beatIds);
    expect(desktopLog.taps).toHaveLength(phoneLog.taps.length);
  }, 600_000);

  it("rehearses a film on the placeholder voiceover, without a paid recording, beside the real film's name", () => {
    const rehearsal = mkdtempSync(join(tmpdir(), "marketing-kit-placeholder-"));
    try {
      const { config } = prepareFixture(rehearsal);
      // No paid voiceover at all: the rehearsal must not need one.
      rmSync(join(rehearsal, "voiceover"), { recursive: true, force: true });
      const main = join(PACKAGE_DIR, "src", "cli", "main.ts");
      const result = spawnSync(TSX, [main, "all", "fixture-tour", "--placeholder", `--config=${config}`, "--quality=draft"], { encoding: "utf8" });
      expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
      const rehearsed = probe(join(rehearsal, "out", "fixture-tour", "fixture-tour.placeholder.mp4"));
      expect(rehearsed.streams.some((stream) => stream.codec_type === "audio")).toBe(true);
      expect(existsSync(join(rehearsal, "out", "fixture-tour", "fixture-tour.mp4"))).toBe(false);
      expect(existsSync(join(rehearsal, "voiceover"))).toBe(false);
      // The placeholder recording never renders with a paid voiceover.
      const real = spawnSync(TSX, [main, "render", "fixture-tour", `--config=${config}`, "--quality=draft"], { encoding: "utf8" });
      expect(real.status).toBe(1);
      expect(real.stderr).toContain("the recording was made on the placeholder voiceover");
    } finally {
      rmSync(rehearsal, { recursive: true, force: true });
    }
  }, 600_000);
});
