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
import { buildFootageDraftCaptions, createOverlayTextMeasure, FOOTAGE_DRAFT_FONT, loadFootageDraftFonts, type FootageDraftFonts } from "../src/footage/draft.js";
import type { Edl } from "../src/footage/edl.js";
import { DEFAULT_TRANSITIONS, type FootageFilm } from "../src/footage/film.js";
import { HAND_FONT } from "../src/footage/hand-font.js";
import type { EdlOverlay } from "../src/footage/overlay-schema.js";
import { getDrawnOverlayCard, resolveEdlOverlays, type ResolvedOverlay } from "../src/footage/overlays.js";
import { readFfmpegListing } from "../src/footage/tools.js";
import type { TimedWord } from "../src/voice/voiceover.js";
import { CHROMIUM_PATH, hasChromium } from "./chromium.js";

/**
 * The draft draws every overlay card in the render's size and shape (RV-194 of an adopting app): the same fixture cut
 * drawn by the render's composition in Chromium (1080x1920, scaled to 540x960) and by the draft's ASS through libass
 * (540x960), every card, mark and accent in one red, no shadows. At each second the red of every overlay (its card, or
 * its highlight marks) must stand where the render's does within 1 % of the frame, its text on as many lines, and the
 * card an app reports (`getDrawnOverlayCard` with the fonts' measure) must be the render's too.
 */

const require = createRequire(import.meta.url);
const FRAME = LAYOUTS["9:16"].frame;
const DRAFT = { width: 540, height: 960 };
const SCENE = "#3366aa";
/** The cards' and accents' colour: red, apart from the scene and the near-white text. */
const CARD = "#cc3333";
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
  captions: false,
  captionPreset: "reels",
  captionStyle: "highlight",
  captionMaxWords: 4,
  endCard: null,
};

const OVERLAYS: EdlOverlay[] = [
  { kind: "hook_title", at: 0, duration: 2.6, text: "What vaccines cost before a long trip", style: { entrance: "fade", backdrop: "highlight" } },
  { kind: "keyword", at: 3, duration: 2.6, text: "booklet = yellow fever certificate", style: { entrance: "wipe", backdrop: "highlight" } },
  { kind: "place_card", at: 6, duration: 2.6, text: "Thailand", subtitle: "Bangkok and the islands", style: { entrance: "fade", size: "s" } },
  { kind: "place_card", at: 9, duration: 2.6, text: "Africa", subtitle: "Kenya and Tanzania", style: { entrance: "fade", subtitle_size: "m" } },
  { kind: "counter", at: 12, duration: 2.6, value: 2800, from: 0, unit: "PLN", style: { entrance: "fade" } },
  { kind: "keyword", at: 15, duration: 2.6, text: "booklet = yellow fever certificate", style: { entrance: "fade" } },
  { kind: "lower_third", at: 18, duration: 2.6, text: "Travel clinic in Warsaw", style: { entrance: "fade" } },
];

const EDL: Edl = { version: 2, film: "trip", segments: [{ id: "s1", clip: "talk", start: 0, end: 22, transition: "cut", motion: "none" }], overlays: OVERLAYS };

/** Spoken words: chunks of four, one of them long enough to wrap only at the render's size. */
const SAID = ["We", "flew", "east", "today", "Extraordinary", "unforgettable", "mountain", "monasteries", "and", "then", "slept", "well"];
const WORDS: TimedWord[] = SAID.map((text, index) => ({ text, start: 0.2 + index * 1.5, end: 0.2 + index * 1.5 + 1.2 }));

const COLORS = {
  background: CARD,
  foreground: "#f2f3f5",
  muted: "#a3a6ad",
  accent: CARD,
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

/** The live overlay's region at `seconds`: the whole frame, as one overlay shows at a time and the cut has no captions. */
function getRegions(overlays: readonly ResolvedOverlay[], seconds: number): Region[] {
  const live = overlays.filter((overlay) => overlay.start <= seconds && seconds < overlay.end);
  return live.map((overlay) => ({ name: `${overlay.kind} at ${String(seconds)} s`, box: { left: 0, top: 0, right: DRAFT.width, bottom: DRAFT.height } }));
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

describe.runIf(hasChromium && canBurn)("the draft draws every overlay card as the render does, at half its resolution", () => {
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
    const ass = buildFootageDraftCaptions({ film, edl: EDL, words: WORDS, caption: CAPTION, frame: FRAME, fonts, colors: COLORS, overlays, overlayColors: { background: CARD, foreground: COLORS.foreground, accent: CARD }, style: STYLE });
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
      (window as unknown as { __timelines: Record<string, { seek: (t: number, suppress?: boolean) => void }> }).__timelines.film?.seek(at, false);
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
      ["-v", "error", "-f", "lavfi", "-i", `color=c=0x${SCENE.slice(1)}:s=${DRAFT.width}x${DRAFT.height}:d=22:r=30`, "-ss", String(seconds), "-vf", "ass=captions.ass:fontsdir=fonts", "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
      { cwd: dir, maxBuffer: DRAFT.width * DRAFT.height * 3 + 1024 },
    );
    if (run.status !== 0) throw new Error(run.stderr.toString());
    return run.stdout;
  }

  /** The bounding box of the card-coloured pixels inside `region`. */
  function findCard(frame: Buffer, region: Region["box"]) {
    const [x0, y0] = [Math.max(0, Math.floor(region.left)), Math.max(0, Math.floor(region.top))];
    const [x1, y1] = [Math.min(DRAFT.width, Math.ceil(region.right)), Math.min(DRAFT.height, Math.ceil(region.bottom))];
    let box: { left: number; top: number; right: number; bottom: number } | null = null;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const at = (y * DRAFT.width + x) * 3;
      const [r, g, b] = [frame[at] ?? 0, frame[at + 1] ?? 0, frame[at + 2] ?? 0];
      if (!(r > 150 && g < 110 && b < 110)) continue;
      box = box === null ? { left: x, top: y, right: x, bottom: y } : { left: Math.min(box.left, x), top: Math.min(box.top, y), right: Math.max(box.right, x), bottom: Math.max(box.bottom, y) };
    }
    return box;
  }

  it.each(MOMENTS)("draws every card at %s s where the render draws it, as large, its text on as many lines", async (seconds) => {
    const render = await grabRender(seconds);
    const draft = grabDraft(seconds);
    saveEvidence(seconds, render, draft);
    const scale = DRAFT.width / FRAME.width;
    const measure = createOverlayTextMeasure(fonts);
    const live = overlays.filter((overlay) => overlay.start <= seconds && seconds < overlay.end);
    expect(live).toHaveLength(1);
    const overlay = live[0] as ResolvedOverlay;
    const [region] = getRegions(live, seconds);
    if (region === undefined) throw new Error(`no region at ${String(seconds)} s`);
    const want = findCard(render, region.box);
    const got = findCard(draft, region.box);
    const reported = getDrawnOverlayCard(overlay, measure);
    expect(want, region.name).not.toBeNull();
    expect(got, region.name).not.toBeNull();
    expect(reported, region.name).not.toBeNull();
    if (want === null || got === null || reported === null) return;
    const near = (a: number, b: number, side: string, of: number) => expect(Math.abs(a - b), `${region.name}: ${side} ${String(a)} vs ${String(b)}`).toBeLessThanOrEqual(of * 0.01);
    near(got.left, want.left, "left", DRAFT.width);
    near(got.right, want.right, "right", DRAFT.width);
    near(got.top, want.top, "top", DRAFT.height);
    near(got.bottom, want.bottom, "bottom", DRAFT.height);
    // The card an app reports, in draft px: where the render draws it.
    near(reported.left * scale, want.left, "reported left", DRAFT.width);
    near((reported.left + reported.width) * scale, want.right + 1, "reported right", DRAFT.width);
    near(reported.top * scale, want.top, "reported top", DRAFT.height);
    near((reported.top + reported.height) * scale, want.bottom + 1, "reported bottom", DRAFT.height);
    const [wantText, gotText] = [findInk(render, region.box), findInk(draft, region.box)];
    expect(gotText?.rows, `${region.name}: lines`).toBe(wantText?.rows);
  });
});
