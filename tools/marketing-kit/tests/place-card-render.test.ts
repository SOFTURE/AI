import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { chromium, type Browser, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { LAYOUTS } from "../src/compose/timeline.js";
import { composeFootage } from "../src/footage/compose.js";
import type { Edl } from "../src/footage/edl.js";
import { DEFAULT_TRANSITIONS, type FootageFilm } from "../src/footage/film.js";
import { getPlaceCardTimes } from "../src/footage/overlay-html.js";
import type { EdlOverlay } from "../src/footage/overlay-schema.js";
import { resolveEdlOverlays, type ResolvedOverlay } from "../src/footage/overlays.js";
import { CHROMIUM_PATH, hasChromium } from "./chromium.js";

/**
 * RV-184 of an adopting app: the render's place card on the frame's axis on every frame of its animation, in a real
 * browser on the composition's own GSAP timeline, with the safe zone whose sides differ most (`all`: 60 and 150 px).
 */

const require = createRequire(import.meta.url);

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
  captionPreset: "all",
  endCard: null,
};

const COLORS = {
  background: "#101820",
  foreground: "#f2f3f5",
  muted: "#a3a6ad",
  accent: "#ff3d7f",
  cta: "#2dd4bf",
  onCta: "#0c0c0d",
  captionBackground: "#ecf1f7",
  captionText: "#0c0c0d",
  captionHighlight: "#059669",
};

const CAPTION = { top: 1290, bottom: 420, left: 120, right: 120, fontSize: 64 };
const FRAME = LAYOUTS["9:16"].frame;

/** The owner's card in fictional text (a 22-character subtitle at size l), and one whose 40-character subtitle wraps. */
const OVERLAYS: EdlOverlay[] = [
  { kind: "place_card", at: 0.5, duration: 3, text: "Kenya", subtitle: "yellow fever card book", style: { position: "top", size: "l", subtitle_size: "m", pin: "drop", subtitle_delay: 0.3 } },
  { kind: "place_card", at: 4.5, duration: 3, text: "Ha Long Bay", subtitle: "Thousands of limestone islands in a bay!", style: { position: "top", size: "l", subtitle_size: "l" } },
];

const EDL: Edl = { version: 2, film: "trip", segments: [{ id: "s1", clip: "talk", start: 0, end: 9, transition: "cut", motion: "none" }], overlays: OVERLAYS };

function getCards(): Extract<ResolvedOverlay, { kind: "place_card" }>[] {
  const result = resolveEdlOverlays({ film, edl: EDL, words: [], frame: FRAME, caption: CAPTION });
  if (!result.ok) throw new Error(result.problems.join("; "));
  return result.overlays.filter((overlay): overlay is Extract<ResolvedOverlay, { kind: "place_card" }> => overlay.kind === "place_card");
}

describe.runIf(hasChromium)("a place card in the browser stays on the frame's axis (RV-184 of an adopting app)", () => {
  let browser: Browser;
  let page: Page;
  let dir: string;
  const cards = getCards();

  beforeAll(async () => {
    browser = await chromium.launch(CHROMIUM_PATH === undefined ? {} : { executablePath: CHROMIUM_PATH });
    dir = mkdtempSync(join(tmpdir(), "place-card-render-"));
    mkdirSync(join(dir, "assets"));
    copyFileSync(require.resolve("gsap/dist/gsap.min.js"), join(dir, "assets", "gsap.min.js"));
    const file = join(dir, "index.html");
    writeFileSync(
      file,
      composeFootage({
        film,
        edl: EDL,
        words: [],
        frame: FRAME,
        caption: CAPTION,
        headlineSize: 96,
        colors: COLORS,
        fonts: { heading: null, body: null },
        assets: { clips: { talk: "clips/talk.mp4" }, picture: "assets/picture.mp4", speech: "assets/speech.mp3", music: null, lastFrame: "assets/last.jpg", logo: null, sfx: {} },
        brandName: "Acme",
        locale: "en-US",
        overlays: cards,
      }),
    );
    page = await browser.newPage({ viewport: { width: FRAME.width, height: FRAME.height } });
    await page.goto(pathToFileURL(file).href);
    await page.evaluate(() => document.fonts.ready);
  });

  afterAll(async () => {
    await browser.close();
    rmSync(dir, { recursive: true, force: true });
  });

  /** Seeks the timeline and shows only the clips live at that second (as hyperframes does at render time). */
  async function seek(seconds: number): Promise<void> {
    await page.evaluate((at) => {
      (window as unknown as { __timelines: Record<string, { seek: (t: number) => void }> }).__timelines.film?.seek(at);
      document.querySelectorAll<HTMLElement>(".clip.ov").forEach((clip) => {
        const start = Number(clip.dataset.start);
        const isLive = start <= at && at < start + Number(clip.dataset.duration);
        clip.style.visibility = isLive ? "visible" : "hidden";
      });
    }, seconds);
  }

  it("resolves both cards in the centred span, the second with its subtitle on two lines", () => {
    expect(cards).toHaveLength(2);
    expect(cards[0]?.subtitleLines).toBeUndefined();
    expect(cards[1]?.subtitleLines).toEqual(["Thousands of limestone", "islands in a bay!"]);
  });

  it.each([0, 1])("keeps card %i's drawn card, title and subtitle centred on every frame of its animation", async (index) => {
    const card = cards[index];
    if (card === undefined) throw new Error("a card");
    const times = getPlaceCardTimes(card);
    const moments = [card.start + 0.05, card.start + 0.2, times.title + 0.1, (times.subtitle ?? card.start) + 0.15, card.start + 1.6, card.end - 0.1];
    for (const seconds of moments) {
      await seek(seconds);
      const rects = await page.$$eval(`#ov${index} .ov-card, #ov${index} .ov-line, #ov${index} .ov-sub`, (elements) => elements.map((element) => element.getBoundingClientRect().toJSON() as DOMRect));
      expect(rects.length, `${seconds} s`).toBeGreaterThanOrEqual(3);
      for (const rect of rects) {
        const middle = rect.left + rect.width / 2;
        expect(Math.abs((middle - FRAME.width / 2) / FRAME.width), `${seconds} s: ${rect.left}..${rect.right}`).toBeLessThanOrEqual(0.01);
      }
    }
    // The drawn card is the resolved box: what the draft draws and `get_draft_frames` reports.
    await seek(card.start + 1.6);
    const drawn = await page.$eval(`#ov${index} .ov-card`, (element) => element.getBoundingClientRect().toJSON() as DOMRect);
    expect(Math.abs(drawn.left - card.box.left)).toBeLessThanOrEqual(1);
    expect(Math.abs(drawn.width - card.box.width)).toBeLessThanOrEqual(1);
  });

  it("draws the wrapped subtitle on two lines inside its card", async () => {
    const card = cards[1];
    if (card === undefined) throw new Error("a card");
    await seek(card.start + 1.6);
    const [sub, box] = await Promise.all([
      page.$eval("#ov1 .ov-sub", (element) => element.getBoundingClientRect().toJSON() as DOMRect),
      page.$eval("#ov1 .ov-card", (element) => element.getBoundingClientRect().toJSON() as DOMRect),
    ]);
    // Two lines of the card's line height (1.15), well over one.
    expect(sub.height).toBeGreaterThan(card.subtitleFontSize * 2);
    expect(sub.height).toBeLessThan(card.subtitleFontSize * 2.6);
    expect(sub.bottom).toBeLessThanOrEqual(box.bottom + 1);
  });
});
