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
import { buildFootageDraftCaptions, FOOTAGE_DRAFT_FONT, loadFootageDraftFonts } from "../src/footage/draft.js";
import type { Edl } from "../src/footage/edl.js";
import { DEFAULT_TRANSITIONS, type FootageFilm } from "../src/footage/film.js";
import { HAND_FONT } from "../src/footage/hand-font.js";
import type { EdlOverlay } from "../src/footage/overlay-schema.js";
import { resolveEdlOverlays, type ResolvedOverlay } from "../src/footage/overlays.js";
import { CHROMIUM_PATH, hasChromium } from "./chromium.js";

/**
 * The draft runs every animation at the render's pace (RV-196 of an adopting app): the same fixture cut as the render's
 * composition in Chromium (its GSAP timeline seeked with events, as a frame capture renders it) and as the draft's ASS
 * read at the same second. At every compared second the draft's counter value, its typed letters and its wipe's
 * opening lie between the render's one frame before and one frame after: within one render frame.
 */

const require = createRequire(import.meta.url);
const FRAME = LAYOUTS["9:16"].frame;
const FPS = 30;
const SCENE = "#3366aa";
const DRAFT = { width: 540, height: 960 };
const CAPTION = { top: 1290, bottom: 420, left: 120, right: 120, fontSize: 64 };
const BODY: BrandFont = { family: "DejaVu Sans", fallback: "sans-serif", files: [{ path: FOOTAGE_DRAFT_FONT.file, weight: "700", style: "normal", unicodeRange: null }] };

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
  endCard: null,
};

const OVERLAYS: EdlOverlay[] = [
  // The adopting app's counter: 2.5 s to 2800, counting over 1.25 s from 0.15 s after it starts.
  { kind: "counter", at: 2, duration: 2.5, value: 2800, unit: "PLN" },
  { kind: "note", at: 6, duration: 3, text: "Worth doing it at home", style: { note_style: "strip", tick: true } },
  { kind: "hook_title", at: 10, duration: 2.8, text: "How much do vaccines cost", style: { entrance: "type" } },
  { kind: "keyword", at: 13, duration: 2.5, text: "booklet = yellow fever", style: { entrance: "wipe" } },
];

const EDL: Edl = { version: 2, film: "trip", segments: [{ id: "s1", clip: "talk", start: 0, end: 16, transition: "cut", motion: "none" }], overlays: OVERLAYS };
const COLORS = { background: SCENE, foreground: "#f2f3f5", muted: "#a3a6ad", accent: "#e8336b", cta: "#2dd4bf", onCta: "#0c0c0d", captionBackground: SCENE, captionText: "#f2f3f5", captionHighlight: "#f2f3f5" };
const LOCALE = "en-US";

/** Seconds where something runs: the count, the strip's and the title's typing (each line), the wipe's grow and reveal. */
const COUNTER_MOMENTS = [2.2, 2.45, 2.7, 3.0, 3.25, 3.5];
const TYPED_MOMENTS = [6.4, 6.75, 7.1, 7.45, 7.8, 10.45, 10.9, 11.35, 11.8];
const WIPE_MOMENTS = [13.04, 13.1, 13.17, 13.23, 13.3, 13.37, 13.44];

const canRun = spawnSync("ffmpeg", ["-hide_banner", "-version"]).status === 0;

interface DraftEvent {
  layer: number;
  from: number;
  to: number;
  text: string;
}

function toSeconds(time: string): number {
  const [hours = "0", minutes = "0", seconds = "0"] = time.split(":");
  return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
}

function readEvents(ass: string): DraftEvent[] {
  return ass
    .split("\n")
    .filter((line) => line.startsWith("Dialogue: "))
    .map((line) => {
      const parts = line.slice("Dialogue: ".length).split(",");
      return { layer: Number(parts[0]), from: toSeconds(parts[1] ?? ""), to: toSeconds(parts[2] ?? ""), text: parts.slice(9).join(",") };
    });
}

const isLive = (event: DraftEvent, seconds: number): boolean => event.from <= seconds && seconds < event.to;

/** The letters a draft event shows: its text up to the first hidden run, tags and drawings left out, spaces not counted. */
function getShownLetters(event: DraftEvent): string {
  if (event.text.includes("\\p1")) return "";
  return event.text.replace(/\{\\1a&HFF&\}.*$/, "").replace(/\{[^}]*\}/g, "").replace(/\s/g, "");
}

/** How far a wipe's clip has opened at `ms` into its event (0 closed, 1 open), libass's straight steps followed. */
function getClipOpening(text: string, ms: number): number | null {
  const start = /\\clip\((-?\d+),(-?\d+),(-?\d+),(-?\d+)\)/.exec(text);
  if (start === null) return null;
  const left = Number(start[1]);
  let right = Number(start[3]);
  let full = right;
  for (const match of text.matchAll(/\\t\((\d+),(\d+),\\clip\((-?\d+),(-?\d+),(-?\d+),(-?\d+)\)\)/g)) {
    const [from, to, x0, x1] = [Number(match[1]), Number(match[2]), Number(match[3]), Number(match[5])];
    if (x0 !== left) break;
    full = x1;
    if (ms >= to) right = x1;
    else if (ms > from) right = right + ((x1 - right) * (ms - from)) / (to - from);
  }
  return full === left ? null : (right - left) / (full - left);
}

/** What the render shows at a second: the counter's value, the typed letters, how far the keyword's card and its text are open. */
interface RenderState {
  counter: number;
  letters: number;
  card: number;
  text: number;
}

function getOverlays(): ResolvedOverlay[] {
  const result = resolveEdlOverlays({ film, edl: EDL, words: [], frame: FRAME, caption: CAPTION });
  if (!result.ok) throw new Error(result.problems.join("; "));
  return result.overlays;
}

describe.runIf(hasChromium && canRun)("the draft runs every animation at the render's pace, within one render frame", () => {
  let browser: Browser;
  let page: Page;
  let dir: string;
  let events: DraftEvent[];
  const overlays = getOverlays();

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), "draft-animation-timing-"));
    mkdirSync(join(dir, "assets", "fonts"), { recursive: true });
    copyFileSync(require.resolve("gsap/dist/gsap.min.js"), join(dir, "assets", "gsap.min.js"));
    for (const file of [FOOTAGE_DRAFT_FONT.file, HAND_FONT.file]) copyFileSync(file, join(dir, "assets", "fonts", basename(file)));
    const face = { family: BODY.family, fallback: BODY.fallback, faces: [{ src: `assets/fonts/${basename(FOOTAGE_DRAFT_FONT.file)}`, weight: "700", style: "normal" as const, unicodeRange: null }] };
    const fonts = loadFootageDraftFonts({ body: BODY, heading: BODY, interface: BODY });
    const ass = buildFootageDraftCaptions({ film, edl: EDL, words: [], caption: CAPTION, frame: FRAME, fonts, colors: COLORS, overlays, overlayColors: { background: COLORS.background, foreground: COLORS.foreground, accent: COLORS.accent }, locale: LOCALE });
    const html = composeFootage({
      film,
      edl: EDL,
      words: [],
      frame: FRAME,
      caption: CAPTION,
      headlineSize: 96,
      colors: COLORS,
      fonts: { heading: face, body: face, interface: face },
      assets: { clips: { talk: "clips/talk.mp4" }, picture: "assets/picture.mp4", speech: "assets/speech.mp3", music: null, lastFrame: "assets/last.jpg", logo: null, sfx: {} },
      brandName: "Acme",
      locale: LOCALE,
      overlays,
    });
    // Only the overlays may differ from the scene: no picture (the fixture has no clips).
    const plain = `<style>html,body,.clip{background:${SCENE}!important}video,img,#picture{visibility:hidden!important}</style>`;
    writeFileSync(join(dir, "index.html"), html.replace("</head>", `${plain}</head>`));
    writeFileSync(join(dir, "captions.ass"), ass ?? "");
    mkdirSync(join(dir, "fonts"));
    for (const file of [FOOTAGE_DRAFT_FONT.file, HAND_FONT.file]) copyFileSync(file, join(dir, "fonts", basename(file)));
    events = readEvents(ass ?? "");
    browser = await chromium.launch(CHROMIUM_PATH === undefined ? {} : { executablePath: CHROMIUM_PATH });
    page = await browser.newPage({ viewport: { width: FRAME.width, height: FRAME.height } });
    await page.goto(pathToFileURL(join(dir, "index.html")).href);
    await page.evaluate(() => document.fonts.ready);
  });

  afterAll(async () => {
    await browser.close();
    rmSync(dir, { recursive: true, force: true });
  });

  /** The render's state at `seconds`: the timeline seeked with its callbacks, as a frame capture renders it. */
  async function readRender(seconds: number): Promise<RenderState> {
    return page.evaluate((at) => {
      (window as unknown as { __timelines: Record<string, { seek: (time: number, suppressEvents: boolean) => void }> }).__timelines.film?.seek(at, false);
      const live = [...document.querySelectorAll<HTMLElement>(".ov")].filter((overlay) => {
        const start = Number(overlay.dataset.start);
        return start <= at && at < start + Number(overlay.dataset.duration);
      });
      const counter = live.map((overlay) => overlay.querySelector('.ov-counter span[id$="n"], span[id$="n"]')?.textContent ?? "").find((text) => text !== "") ?? "";
      const letters = live
        .flatMap((overlay) => [...overlay.querySelectorAll<HTMLElement>(".ch")])
        .filter((char) => getComputedStyle(char).display !== "none" && Number(getComputedStyle(char).opacity) >= 0.5 && (char.textContent ?? "").trim() !== "").length;
      const keyword = live.find((overlay) => overlay.classList.contains("ov-keyword"));
      const card = keyword?.querySelector<HTMLElement>(".ov-card");
      const inset = card === undefined || card === null ? null : /inset\(\S+ (\S+)%/.exec(getComputedStyle(card).clipPath);
      // The accent panel shrinks to the right (scaleX 1 to 0): the text is open as far as the panel has gone.
      const panel = keyword?.querySelector<HTMLElement>(".ov-wipe");
      const scale = panel === undefined || panel === null ? 0 : new DOMMatrix(getComputedStyle(panel).transform).a;
      return { counter: Number(counter.replace(/\D/g, "")), letters, card: inset === null ? 1 : 1 - Number(inset[1]) / 100, text: 1 - scale };
    }, seconds);
  }

  function readDraft(seconds: number): RenderState {
    const live = events.filter((event) => isLive(event, seconds));
    const counterText = live.map(getShownLetters).find((text) => /^\d[\d,]*PLN$/.test(text)) ?? "";
    const letters = live.filter((event) => event.layer === 4 && !/^\d/.test(getShownLetters(event))).map(getShownLetters).join("").length;
    // The keyword's card is drawn on layer 3 for its whole span, its accent panel on layer 3 for the wipe only, its text on 4.
    const wiped = live.filter((event) => event.from === 13 && event.text.includes("\\t("));
    const opening = (event: DraftEvent | undefined) => (event === undefined ? -1 : (getClipOpening(event.text, Math.round((seconds - event.from) * 1000)) ?? -1));
    return { counter: Number(counterText.replace(/\D/g, "")), letters, card: opening(wiped.find((event) => event.layer === 3 && event.to > 13.5)), text: opening(wiped.find((event) => event.layer === 4)) };
  }

  /**
   * With `DRAFT_TIMING_EVIDENCE` set to a folder, a compared second is written there as one picture: the render
   * (scaled to the draft's size) on the left, the draft on the right. Evidence for a review, never committed.
   */
  async function saveEvidence(seconds: number, name: string): Promise<void> {
    const folder = process.env.DRAFT_TIMING_EVIDENCE;
    if (folder === undefined || folder === "") return;
    await readRender(seconds);
    // Only the overlays live at that second show, as a frame capture shows them.
    await page.evaluate((at) => {
      document.querySelectorAll<HTMLElement>(".ov").forEach((overlay) => {
        const start = Number(overlay.dataset.start);
        overlay.style.visibility = start <= at && at < start + Number(overlay.dataset.duration) ? "visible" : "hidden";
      });
    }, seconds);
    const size = `${String(DRAFT.width)}x${String(DRAFT.height)}`;
    writeFileSync(join(dir, "render.png"), await page.screenshot());
    const draft = spawnSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", `color=c=0x${SCENE.slice(1)}:s=${size}:d=16:r=30`, "-ss", String(seconds), "-vf", "ass=captions.ass:fontsdir=fonts", "-frames:v", "1", "draft.png"], { cwd: dir });
    if (draft.status !== 0) throw new Error(draft.stderr.toString());
    const run = spawnSync("ffmpeg", ["-v", "error", "-y", "-i", "render.png", "-i", "draft.png", "-filter_complex", `[0:v]scale=${size}:flags=area[r];[r][1:v]hstack`, "-frames:v", "1", join(folder, `${name}-${seconds.toFixed(2)}s-render-left-draft-right.png`)], { cwd: dir });
    if (run.status !== 0) throw new Error(run.stderr.toString());
  }

  /** The draft's value lies between the render's one frame before and one frame after. */
  async function expectWithinOneFrame(seconds: number, read: (state: RenderState) => number, draft: number): Promise<void> {
    const [before, after] = [read(await readRender(seconds - 1 / FPS)), read(await readRender(seconds + 1 / FPS))];
    const [low, high] = [Math.min(before, after), Math.max(before, after)];
    expect(draft, `at ${String(seconds)} s the render shows ${String(read(await readRender(seconds)))} (${String(before)} a frame before, ${String(after)} after)`).toBeGreaterThanOrEqual(low - 1e-6);
    expect(draft).toBeLessThanOrEqual(high + 1e-6);
  }

  it.each(COUNTER_MOMENTS)("counts the counter at %s s as the render does", async (seconds) => {
    const draft = readDraft(seconds).counter;
    expect(draft).toBeGreaterThan(0);
    await saveEvidence(seconds, "counter");
    await expectWithinOneFrame(seconds, (state) => state.counter, draft);
  });

  it.each(TYPED_MOMENTS)("has typed as many letters at %s s as the render", async (seconds) => {
    const draft = readDraft(seconds).letters;
    expect(draft).toBeGreaterThan(0);
    await saveEvidence(seconds, "typed");
    await expectWithinOneFrame(seconds, (state) => state.letters, draft);
  });

  it.each(WIPE_MOMENTS)("has wiped the keyword's card and text as far open at %s s as the render", async (seconds) => {
    const draft = readDraft(seconds);
    expect(draft.card).toBeGreaterThanOrEqual(0);
    expect(draft.text).toBeGreaterThanOrEqual(0);
    await saveEvidence(seconds, "wipe");
    await expectWithinOneFrame(seconds, (state) => state.card, draft.card);
    await expectWithinOneFrame(seconds, (state) => state.text, draft.text);
  });
});
