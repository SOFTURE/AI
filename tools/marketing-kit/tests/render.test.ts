import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { prepareFixture, prepareFootageFixture } from "../examples/fixture/prepare.js";
import { findFootage, loadMarketingConfig } from "../src/config/config.js";
import { createFakeIsolationProvider, createFakeMusicProvider, createFakeSttProvider } from "../src/footage/fake.js";
import { buildLoudnessMeasureArgs, DEFAULT_LOUDNESS, readLoudnessMeasurement } from "../src/footage/loudness.js";
import { estimateFootageFilm, findCachedStep } from "../src/footage/paid.js";
import { renderFootageFilm, type RenderFootageFilmOptions } from "../src/footage/pipeline.js";
import { probeFile } from "../src/footage/probe.js";
import type { FootageCharge, FootageProgress } from "../src/footage/providers.js";
import { findFinishProblems, probeFilmFacts, readTopLevelBoxes } from "../src/footage/publish.js";
import { checkFootageTools } from "../src/footage/tools.js";

/**
 * The whole pipeline on the fixture film: start the fixture app, record it frame by frame, compose
 * and render a draft MP4 with hyperframes, write the post copy; then record the film's JSON twin
 * (beat actions instead of the scene module) and compare the two recording logs; then record and render the same
 * scene as a desktop film in a browser window (16:9). Apart from those, the fixture footage film from generated phone
 * clips: rehearsed with --placeholder after a dry run that pays nothing, then run as a jobs worker would (estimate in
 * credits, fake paid providers, progress, charges, an aborted render). The worker image's CI job runs only the footage
 * films (`-t "fixture footage film"`).
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

describe.runIf(isEnabled)("the fixture footage film", () => {
  it("cuts the fixture footage film from phone clips on placeholder transcripts and renders it", async () => {
    const footage = mkdtempSync(join(tmpdir(), "marketing-kit-footage-"));
    try {
      const { config } = prepareFixture(footage);
      prepareFootageFixture(footage);
      // The generated clips are what a phone writes: a rotation in the display matrix, and HLG HDR.
      const talk = await probeFile(join(footage, "footage", "talk.mp4"));
      const sunset = await probeFile(join(footage, "footage", "sunset.mp4"));
      expect(talk.ok && [talk.probe.rotation, talk.probe.displayWidth, talk.probe.displayHeight]).toEqual([90, 540, 960]);
      expect(sunset.ok && sunset.probe.hdr).toBe("hlg");
      const main = join(PACKAGE_DIR, "src", "cli", "main.ts");

      // Without --commit and without a cached transcript, the run only prints what it would pay for.
      const dry = spawnSync(TSX, [main, "footage", "fixture-footage", `--config=${config}`], { encoding: "utf8" });
      expect(dry.status, `${dry.stdout}\n${dry.stderr}`).toBe(0);
      expect(dry.stdout).toContain("speech to text (elevenlabs) for clip talk: 7.0 s");
      expect(dry.stdout).toContain("footage DRY RUN: nothing was sent.");
      expect(existsSync(join(footage, "voiceover", "fixture-footage"))).toBe(false);

      const result = spawnSync(TSX, [main, "footage", "fixture-footage", "--placeholder", `--config=${config}`, "--quality=draft"], { encoding: "utf8" });
      expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
      const video = join(footage, "out", "fixture-footage", "fixture-footage.placeholder.mp4");
      const rendered = probe(video);
      const stream = rendered.streams.find((entry) => entry.codec_type === "video");
      expect([stream?.width, stream?.height]).toEqual([1080, 1920]);
      expect(rendered.streams.some((entry) => entry.codec_type === "audio")).toBe(true);
      const printed = Number(/\((\d+(?:\.\d+)?) s, 9:16\)/.exec(result.stdout)?.[1]);
      expect(Math.abs(Number(rendered.format.duration) - printed)).toBeLessThan(0.5);
      // The filler is cut: the talking clip comes back in two segments of its one sentence, joined by a hard cut.
      const edl = JSON.parse(readFileSync(join(footage, "build", "fixture-footage", "edl.placeholder.json"), "utf8")) as { segments: { id: string; clip: string; transition: string }[] };
      expect(edl.segments.map((segment) => `${segment.id}:${segment.clip}:${segment.transition}`)).toEqual(["s1:talk:cut", "s1.2:talk:cut", "r1:street:whoosh", "r2:sunset:whoosh"]);
      expect(readFileSync(join(footage, "out", "fixture-footage", "posts.md"), "utf8")).toContain("Filmed on a phone, cut by its transcript.");
      expect(existsSync(join(footage, "voiceover", "fixture-footage"))).toBe(false);
      // Publishable: H.264 High, AAC 48 kHz stereo, fast start, a cover next to it, the speech at the loudness target.
      const facts = await probeFilmFacts(video);
      if (!facts.ok) throw new Error(facts.error);
      expect(facts.facts.video).toEqual({ codec: "h264", profile: "High", pixelFormat: "yuv420p" });
      expect(facts.facts.audio).toEqual({ codec: "aac", sampleRate: 48000, channels: 2 });
      expect(findFinishProblems(facts.facts, readTopLevelBoxes(video))).toEqual([]);
      expect(existsSync(join(footage, "out", "fixture-footage", "fixture-footage.placeholder.jpg"))).toBe(true);
      expect(result.stdout).toContain("fixture-footage.placeholder.jpg: cover");
      const speech = spawnSync("ffmpeg", buildLoudnessMeasureArgs(join(footage, "build", "fixture-footage", "assets", "speech.mp3"), DEFAULT_LOUDNESS), { encoding: "utf8" });
      const loudness = readLoudnessMeasurement(speech.stderr);
      expect(Math.abs((loudness?.inputI ?? 0) - DEFAULT_LOUDNESS.target)).toBeLessThan(1);
    } finally {
      rmSync(footage, { recursive: true, force: true });
    }
  }, 600_000);

  it("runs the fixture footage film as a jobs worker would: estimate, progress, charges, abort", async () => {
    const footage = mkdtempSync(join(tmpdir(), "marketing-kit-worker-"));
    try {
      expect(await checkFootageTools()).toEqual([]);
      const { config } = prepareFixture(footage);
      prepareFootageFixture(footage);
      const loaded = loadMarketingConfig(config);
      if (!loaded.ok) throw new Error("the fixture config does not load");
      const film = findFootage(loaded.config, "fixture-footage");
      if (film === null) throw new Error("no fixture footage film");
      const providers = {
        stt: createFakeSttProvider({ transcripts: { talk: [{ text: "Hello", start: 0.5, end: 1 }, { text: "today.", start: 1.2, end: 1.8 }] }, credits: 42 }),
        isolation: createFakeIsolationProvider(),
        music: createFakeMusicProvider(),
      };
      const cacheDir = join(footage, "cache");
      const buildDir = join(footage, "build", "worker");
      const rates = { transcribe: 2, isolate: 1, music: 5 };

      // Before anything runs: probes only, nothing normalized, nothing paid.
      const estimate = await estimateFootageFilm(film, { cacheDir, providers, rates, buildDir });
      expect(estimate).toEqual({
        ok: true,
        value: { items: [{ step: "transcribe", item: "talk", provider: "fake", units: 7, unit: "seconds", credits: 14, cached: false }], totalCredits: 14 },
      });
      expect(existsSync(join(buildDir, "clips"))).toBe(false);

      const progress: FootageProgress[] = [];
      const charges: FootageCharge[] = [];
      const controller = new AbortController();
      const run: RenderFootageFilmOptions = {
        buildDir,
        cacheDir,
        providers,
        isCommit: true,
        isPlaceholder: false,
        log: () => undefined,
        signal: controller.signal,
        onProgress: (entry) => {
          progress.push(entry);
          // Stops the film once hyperframes has started: the render must end at once and leave no partial MP4.
          if (entry.step === "render" && entry.done === 0) controller.abort();
        },
        onCharge: (charge) => charges.push(charge),
        brand: { name: "Fixture", locale: "en-US", colors: loaded.config.brand.colors, fonts: loaded.config.brand.fonts, logo: loaded.config.brand.logo },
        sfx: loaded.config.sfx,
        quality: "draft",
        output: join(footage, "out", "worker.mp4"),
      };
      await expect(renderFootageFilm(film, run)).rejects.toThrow(/abort/i);
      expect(existsSync(run.output)).toBe(false);
      expect(charges).toEqual([{ step: "transcribe", item: "talk", provider: "fake", units: 7, credits: 42, cacheKey: expect.stringMatching(/^[0-9a-f]{16}$/) as string }]);
      const normalized = progress.filter((entry) => entry.step === "normalize");
      expect(normalized.at(-1)).toEqual({ step: "normalize", item: "sunset", itemIndex: 3, itemCount: 3, done: 12.5, total: 12.5 });
      expect(new Set(progress.map((entry) => entry.step))).toEqual(new Set(["normalize", "transcribe", "assets", "render"]));
      expect(await findCachedStep(film, "transcribe", "talk", { cacheDir, providers, buildDir })).toBe(true);

      // The paid step is cached now: the estimate costs nothing, and the second run renders without paying again.
      const cached = await estimateFootageFilm(film, { cacheDir, providers, rates, buildDir });
      expect(cached.ok && cached.value.totalCredits).toBe(0);
      const rendered = await renderFootageFilm(film, { ...run, signal: new AbortController().signal, onProgress: (entry) => progress.push(entry) });
      if (!rendered.ok || rendered.value.kind !== "rendered") throw new Error("the film did not render");
      expect(charges).toHaveLength(1);
      expect(progress.filter((entry) => entry.step === "render").at(-1)).toMatchObject({ itemIndex: 1, itemCount: 1 });
      expect(progress.filter((entry) => entry.step === "finish").at(-1)).toMatchObject({ item: "film", itemIndex: 1, itemCount: 1 });
      const video = probe(run.output);
      expect(video.streams.find((entry) => entry.codec_type === "video")).toMatchObject({ width: 1080, height: 1920 });
      // The facts come from the written file; the cover sits next to it.
      const { bytes, width, height, durationSeconds, cover } = rendered.value;
      expect([bytes, width, height]).toEqual([statSync(run.output).size, 1080, 1920]);
      expect(Math.abs(durationSeconds - Number(video.format.duration))).toBeLessThan(0.01);
      expect(cover).toBe(join(footage, "out", "worker.jpg"));
      expect(existsSync(join(buildDir, "render.mp4"))).toBe(false);
    } finally {
      rmSync(footage, { recursive: true, force: true });
    }
  }, 600_000);
});
