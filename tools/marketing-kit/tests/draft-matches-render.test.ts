import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { pathToFileURL } from "node:url";

import { chromium, type Browser, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { LAYOUTS } from "../src/compose/timeline.js";
import type { BrandFont } from "../src/config/config.js";
import { composeFootage } from "../src/footage/compose.js";
import { buildFootageDraftCaptions, FOOTAGE_DRAFT_FONT, loadFootageDraftFonts, type FootageDraftFonts } from "../src/footage/draft.js";
import type { Edl } from "../src/footage/edl.js";
import { DEFAULT_TRANSITIONS, type FootageFilm } from "../src/footage/film.js";
import { HAND_FONT } from "../src/footage/hand-font.js";
import type { EdlOverlay } from "../src/footage/overlay-schema.js";
import { getOverlayBounds, resolveEdlOverlays, type ResolvedOverlay } from "../src/footage/overlays.js";
import { readFfmpegListing } from "../src/footage/tools.js";
import type { TimedWord } from "../src/voice/voiceover.js";
import { CHROMIUM_PATH, hasChromium } from "./chromium.js";

/**
 * The draft is the render at half resolution (RV-193 of an adopting app): the same fixture cut drawn by the render's
 * composition in Chromium (1080x1920, scaled to 540x960) and by the draft's ASS through libass (540x960), with every
 * card, accent and caption box in the picture's colour and no shadows, so only the text shows. At each second the
 * text of every overlay and caption must stand in the same place, as large and on as many lines.
 */

const require = createRequire(import.meta.url);
const FRAME = LAYOUTS["9:16"].frame;
const DRAFT = { width: 540, height: 960 };
const SCENE = "#3366aa";
const CAPTION = { top: 1290, bottom: 420, left: 120, right: 120, fontSize: 64 };

/** The kit's own fixture fonts: DejaVu Sans Bold for the body and the interface, Caveat SemiBold for the headings. */
const BODY: BrandFont = { family: "DejaVu Sans", fallback: "sans-serif", files: [{ path: FOOTAGE_DRAFT_FONT.file, weight: "700", style: "normal", unicodeRange: null }] };
const HEADING: BrandFont = { family: "Caveat", fallback: "cursive", files: [{ path: HAND_FONT.file, weight: "600", style: "normal", unicodeRange: null }] };

const film: FootageFilm = {
  id: "trip",
  title: "Trip",
  format: "9:16",
  language: "en",
  clips: [],
  isolateVoice: false,
  cut: { fillers: [], pauseSeconds: 0.6, padSeconds: 0.1, maxSeconds: null },
  transitions: DEFAULT_TRANSITIONS,
  music: { source: { kind: "none" }, volume: 0.35, duckedVolume: 0.1 },
  captions: true,
  captionPreset: "reels",
  captionStyle: "highlight",
  captionMaxWords: 4,
  endCard: null,
};

const OVERLAYS: EdlOverlay[] = [
  { kind: "hook_title", at: 0, duration: 2.6, text: "What vaccines cost before Asia", style: { entrance: "fade" } },
  { kind: "place_card", at: 3, duration: 2.6, text: "Thailand", subtitle: "Bangkok and the islands", style: { entrance: "fade" } },
  // The count itself is the timing change's: counting one step, both show four digits of the same widths.
  { kind: "counter", at: 6, duration: 2.6, value: 2800, from: 2799, unit: "PLN", style: { entrance: "fade" } },
  { kind: "keyword", at: 9, duration: 2.6, text: "booklet = yellow fever certificate", style: { entrance: "fade" } },
  { kind: "lower_third", at: 12, duration: 2.6, text: "Travel clinic in Warsaw", style: { entrance: "fade" } },
  { kind: "list", at: 15, duration: 2.6, items: ["Hepatitis A and B", "Typhoid", "Rabies"], style: { entrance: "fade" } },
];

const EDL: Edl = { version: 2, film: "trip", segments: [{ id: "s1", clip: "talk", start: 0, end: 20, transition: "cut", motion: "none" }], overlays: OVERLAYS };

/** Spoken words: chunks of four, one of them long enough to wrap only at the render's size. */
const SAID = ["We", "flew", "east", "today", "Extraordinary", "unforgettable", "mountain", "monasteries", "and", "then", "slept", "well"];
const WORDS: TimedWord[] = SAID.map((text, index) => ({ text, start: 0.2 + index * 1.5, end: 0.2 + index * 1.5 + 1.2 }));

const COLORS = {
  background: SCENE,
  foreground: "#f2f3f5",
  muted: "#a3a6ad",
  accent: SCENE,
  cta: "#2dd4bf",
  onCta: "#0c0c0d",
  captionBackground: SCENE,
  captionText: "#f2f3f5",
  captionHighlight: "#f2f3f5",
};

const STYLE = { cornerRadius: "m", padding: "m", shadow: "none", border: "none" } as const;

/** Seconds where every text has come in and none has started to leave: two per overlay, plus captions on their own. */
const MOMENTS = OVERLAYS.flatMap((overlay) => [(overlay.at ?? 0) + 1.2, (overlay.at ?? 0) + 2.1]);

const canBurn = (() => {
  const run = spawnSync("ffmpeg", ["-hide_banner", "-filters"], { encoding: "utf8" });
  return run.status === 0 && readFfmpegListing(run.stdout).has("ass");
})();

function getOverlays(): ResolvedOverlay[] {
  const result = resolveEdlOverlays({ film, edl: EDL, words: WORDS, frame: FRAME, caption: CAPTION, style: STYLE });
  if (!result.ok) throw new Error(result.problems.join("; "));
  return result.overlays;
}

interface Region {
  name: string;
  /** In px of the 540x960 draft. */
  box: { left: number; top: number; right: number; bottom: number };
}

/** Where each overlay's text may be at `seconds`, and the captions' band, in draft px. */
function getRegions(overlays: readonly ResolvedOverlay[], seconds: number): Region[] {
  const scale = DRAFT.width / FRAME.width;
  const live = overlays.filter((overlay) => overlay.start <= seconds && seconds < overlay.end);
  const regions = live.flatMap((overlay) => {
    const bounds = getOverlayBounds(overlay);
    if (bounds === null) return [];
    const margin = 60;
    return [
      {
        name: `${overlay.kind} at ${String(seconds)} s`,
        box: { left: (bounds.left - margin) * scale, top: (bounds.top - margin) * scale, right: (bounds.left + bounds.width + margin) * scale, bottom: (bounds.top + bounds.height + margin) * scale },
      },
    ];
  });
  // The captions' band, below every live overlay's region (a lower third stands just above the captions).
  const top = Math.max((FRAME.height - CAPTION.bottom - 400) * scale, ...regions.map((region) => region.box.bottom));
  return [...regions, { name: `captions at ${String(seconds)} s`, box: { left: 0, top, right: DRAFT.width, bottom: (FRAME.height - CAPTION.bottom + 40) * scale } }];
}

interface Ink {
  left: number;
  top: number;
  right: number;
  bottom: number;
  /** Runs of rows with ink, separated by at least two empty rows: the text's lines. */
  rows: number;
}

/** The ink (the near-white text) of an RGB frame inside `region`, or null when there is none. */
function findInk(frame: Buffer, region: Region["box"]): Ink | null {
  const [x0, y0] = [Math.max(0, Math.floor(region.left)), Math.max(0, Math.floor(region.top))];
  const [x1, y1] = [Math.min(DRAFT.width, Math.ceil(region.right)), Math.min(DRAFT.height, Math.ceil(region.bottom))];
  let ink: Omit<Ink, "rows"> | null = null;
  const inked: boolean[] = [];
  for (let y = y0; y < y1; y++) {
    let isRowInked = false;
    for (let x = x0; x < x1; x++) {
      const at = (y * DRAFT.width + x) * 3;
      // The text is near white; the scene, the cards in its colour and the page behind them are not.
      if (Math.min(frame[at] ?? 0, frame[at + 1] ?? 0, frame[at + 2] ?? 0) < 150) continue;
      isRowInked = true;
      ink = ink === null ? { left: x, top: y, right: x, bottom: y } : { left: Math.min(ink.left, x), top: Math.min(ink.top, y), right: Math.max(ink.right, x), bottom: Math.max(ink.bottom, y) };
    }
    inked.push(isRowInked);
  }
  if (ink === null) return null;
  let rows = 0;
  let gap = 2;
  for (const isInked of inked) {
    if (isInked && gap >= 2) rows++;
    gap = isInked ? 0 : gap + 1;
  }
  return { ...ink, rows };
}

/** A PNG (or any picture ffmpeg reads) scaled to the draft's size as raw RGB. */
function toDraftRgb(input: Buffer): Buffer {
  const run = spawnSync("ffmpeg", ["-v", "error", "-i", "-", "-vf", `scale=${DRAFT.width}:${DRAFT.height}:flags=area`, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], { input, maxBuffer: DRAFT.width * DRAFT.height * 3 + 1024 });
  if (run.status !== 0) throw new Error(run.stderr.toString());
  return run.stdout;
}

/**
 * With `DRAFT_RENDER_EVIDENCE` set to a folder, each compared moment is written there as one picture: the render
 * (scaled) on the left, the draft on the right. Evidence for a change's review, never committed.
 */
function saveEvidence(seconds: number, render: Buffer, draft: Buffer): void {
  const folder = process.env.DRAFT_RENDER_EVIDENCE;
  if (folder === undefined || folder === "") return;
  const input = Buffer.concat([render, draft]);
  const size = `${String(DRAFT.width)}x${String(DRAFT.height)}`;
  const graph = `[0:v]crop=${String(DRAFT.width)}:${String(DRAFT.height)}:0:0[a];[0:v]crop=${String(DRAFT.width)}:${String(DRAFT.height)}:0:${String(DRAFT.height)}[b];[a][b]hstack`;
  const run = spawnSync("ffmpeg", ["-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", `${String(DRAFT.width)}x${String(DRAFT.height * 2)}`, "-i", "-", "-filter_complex", graph, join(folder, `${seconds.toFixed(1)}s-render-vs-draft-${size}.png`)], { input });
  if (run.status !== 0) throw new Error(run.stderr.toString());
}

describe.runIf(hasChromium && canBurn)("the draft draws every text as the render does, at half its resolution", () => {
  let browser: Browser;
  let page: Page;
  let dir: string;
  const overlays = getOverlays();
  let fonts: FootageDraftFonts;

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), "draft-matches-render-"));
    mkdirSync(join(dir, "assets", "fonts"), { recursive: true });
    mkdirSync(join(dir, "fonts"));
    copyFileSync(require.resolve("gsap/dist/gsap.min.js"), join(dir, "assets", "gsap.min.js"));
    for (const file of [FOOTAGE_DRAFT_FONT.file, HAND_FONT.file]) {
      copyFileSync(file, join(dir, "assets", "fonts", basename(file)));
      copyFileSync(file, join(dir, "fonts", basename(file)));
    }
    fonts = loadFootageDraftFonts({ body: BODY, heading: HEADING, interface: BODY });
    const face = (font: BrandFont) => ({ family: font.family, fallback: font.fallback, faces: font.files.map((file) => ({ src: `assets/fonts/${basename(file.path)}`, weight: file.weight, style: file.style, unicodeRange: null })) });
    const html = composeFootage({
      film,
      edl: EDL,
      words: WORDS,
      frame: FRAME,
      caption: CAPTION,
      headlineSize: 96,
      colors: COLORS,
      fonts: { heading: face(HEADING), body: face(BODY), interface: face(BODY) },
      assets: { clips: { talk: "clips/talk.mp4" }, picture: "assets/picture.mp4", speech: "assets/speech.mp3", music: null, lastFrame: "assets/last.jpg", logo: null, sfx: {} },
      brandName: "Acme",
      locale: "en-US",
      overlays,
      style: STYLE,
    });
    // Only text may differ from the scene: no picture, no shadows.
    const plain = `<style>html,body,.clip{background:${SCENE}!important}video,img,#picture{visibility:hidden!important}*{box-shadow:none!important;text-shadow:none!important}</style>`;
    writeFileSync(join(dir, "index.html"), html.replace("</head>", `${plain}</head>`));
    const ass = buildFootageDraftCaptions({ film, edl: EDL, words: WORDS, caption: CAPTION, frame: FRAME, fonts, colors: COLORS, overlays, overlayColors: { background: SCENE, foreground: COLORS.foreground, accent: SCENE }, style: STYLE });
    writeFileSync(join(dir, "captions.ass"), ass ?? "");
    browser = await chromium.launch(CHROMIUM_PATH === undefined ? {} : { executablePath: CHROMIUM_PATH });
    page = await browser.newPage({ viewport: { width: FRAME.width, height: FRAME.height } });
    await page.goto(pathToFileURL(join(dir, "index.html")).href);
    await page.evaluate(() => document.fonts.ready);
  });

  afterAll(async () => {
    await browser.close();
    rmSync(dir, { recursive: true, force: true });
  });

  /** The render's frame at `seconds`: the timeline seeked and only the clips live then shown, as hyperframes does. */
  async function grabRender(seconds: number): Promise<Buffer> {
    await page.evaluate((at) => {
      (window as unknown as { __timelines: Record<string, { seek: (t: number) => void }> }).__timelines.film?.seek(at);
      document.querySelectorAll<HTMLElement>(".clip").forEach((clip) => {
        if (clip.dataset.start === undefined) return;
        const start = Number(clip.dataset.start);
        clip.style.visibility = start <= at && at < start + Number(clip.dataset.duration) ? "visible" : "hidden";
      });
    }, seconds);
    return toDraftRgb(await page.screenshot());
  }

  /** The draft's frame at `seconds`: its ASS burnt by libass over the scene at 540x960. */
  function grabDraft(seconds: number): Buffer {
    const run = spawnSync(
      "ffmpeg",
      ["-v", "error", "-f", "lavfi", "-i", `color=c=0x${SCENE.slice(1)}:s=${DRAFT.width}x${DRAFT.height}:d=20:r=30`, "-ss", String(seconds), "-vf", "ass=captions.ass:fontsdir=fonts", "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
      { cwd: dir, maxBuffer: DRAFT.width * DRAFT.height * 3 + 1024 },
    );
    if (run.status !== 0) throw new Error(run.stderr.toString());
    return run.stdout;
  }

  it("sizes every font as the render does: an em of the render's px, by the font's own win metrics", () => {
    expect(fonts.body.assScale).toBeCloseTo(2384 / 2048, 6);
    expect(fonts.heading.family).toBe("Caveat");
    expect(fonts.interface).toBe(fonts.body);
  });

  it.each(MOMENTS)("draws the text at %s s where the render draws it, as large and on as many lines", async (seconds) => {
    const render = await grabRender(seconds);
    const draft = grabDraft(seconds);
    saveEvidence(seconds, render, draft);
    const regions = getRegions(overlays, seconds);
    let compared = 0;
    for (const region of regions) {
      const want = findInk(render, region.box);
      const got = findInk(draft, region.box);
      if (want === null && region.name.startsWith("captions")) {
        expect(got, region.name).toBeNull();
        continue;
      }
      expect(want, region.name).not.toBeNull();
      expect(got, region.name).not.toBeNull();
      if (want === null || got === null) continue;
      compared++;
      expect(got.rows, `${region.name}: lines`).toBe(want.rows);
      // Within 2 % of the frame on every side of the text.
      expect(Math.abs(got.right - got.left - (want.right - want.left)), `${region.name}: width ${got.right - got.left} vs ${want.right - want.left}`).toBeLessThanOrEqual(DRAFT.width * 0.02);
      // The draft draws no lower third's dot yet, so its text starts that much further left (the cards' change).
      if (!region.name.startsWith("lower_third")) {
        expect(Math.abs(got.left - want.left), `${region.name}: left ${got.left} vs ${want.left}`).toBeLessThanOrEqual(DRAFT.width * 0.02);
        expect(Math.abs(got.right - want.right), `${region.name}: right ${got.right} vs ${want.right}`).toBeLessThanOrEqual(DRAFT.width * 0.02);
      }
      expect(Math.abs(got.top - want.top), `${region.name}: top ${got.top} vs ${want.top}`).toBeLessThanOrEqual(DRAFT.height * 0.02);
      expect(Math.abs(got.bottom - want.bottom), `${region.name}: bottom ${got.bottom} vs ${want.bottom}`).toBeLessThanOrEqual(DRAFT.height * 0.02);
    }
    expect(compared).toBeGreaterThanOrEqual(1);
  });
});
