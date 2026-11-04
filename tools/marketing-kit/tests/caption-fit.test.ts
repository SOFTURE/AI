import { chromium, type Browser } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { LAYOUTS } from "../src/compose/timeline.js";
import { composeFootage, type FootageComposeInput } from "../src/footage/compose.js";
import { DEFAULT_TRANSITIONS, type FootageFilm } from "../src/footage/film.js";
import { CHROMIUM_PATH, hasChromium } from "./chromium.js";

/** The footage composition's captions in a real browser: the bottom anchor and the line limit (#1026). */

const film: FootageFilm = {
  id: "street",
  title: "Street",
  format: "9:16",
  language: "pl",
  clips: [],
  isolateVoice: false,
  cut: { fillers: [], pauseSeconds: 0.6, padSeconds: 0.1, maxSeconds: null },
  transitions: DEFAULT_TRANSITIONS,
  music: { source: { kind: "none" }, volume: 0.35, duckedVolume: 0.1 },
  captions: true,
  endCard: null,
};

function input(changes: Partial<FootageComposeInput>): FootageComposeInput {
  return {
    film,
    edl: { version: 2, film: "street", segments: [{ id: "g1", clip: "talk", start: 0, end: 3, transition: "cut", motion: "none" }] },
    words: [],
    frame: LAYOUTS["9:16"].frame,
    caption: LAYOUTS["9:16"].caption,
    headlineSize: 96,
    colors: {
      background: "#0c0c0d",
      foreground: "#f2f3f5",
      muted: "#a3a6ad",
      accent: "#cff26b",
      cta: "#2dd4bf",
      onCta: "#0c0c0d",
      captionBackground: "#ecf1f7",
      captionText: "#0c0c0d",
      captionHighlight: "#059669",
    },
    fonts: { heading: null, body: null },
    assets: { clips: { talk: "clips/talk.mp4" }, speech: "assets/speech.mp3", music: null, lastFrame: "assets/last.jpg", logo: null, sfx: { whoosh: "assets/sfx/whoosh.mp3", pop: "assets/sfx/pop.mp3" } },
    brandName: "Acme",
    locale: "pl-PL",
    ...changes,
  };
}

/** A card of long words in a 780 px box at 58 px, anchored by its foot 420 px above the frame's bottom. */
const LONG_CARD = [
  { text: "Internationalization", start: 0.1, end: 0.6 },
  { text: "extraordinary", start: 0.7, end: 1.1 },
  { text: "mountain", start: 1.2, end: 1.6 },
  { text: "landscapes", start: 1.7, end: 2.1 },
];
const LOW_BOX = { top: 1400, bottom: 420, left: 150, right: 150, fontSize: 58 };

describe.runIf(hasChromium)("a highlight card in the browser", () => {
  let browser: Browser;

  beforeAll(async () => {
    browser = await chromium.launch(CHROMIUM_PATH === undefined ? {} : { executablePath: CHROMIUM_PATH });
  });

  afterAll(async () => {
    await browser.close();
  });

  /** The first card's line count, font size and foot, in px from the frame's top. */
  async function measureCard(maxLines: number | undefined): Promise<{ lines: number; fontSize: number; foot: number }> {
    const highlight: FootageFilm = { ...film, captionStyle: "highlight", ...(maxLines === undefined ? {} : { captionMaxLines: maxLines }) };
    const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
    try {
      await page.setContent(composeFootage(input({ film: highlight, words: LONG_CARD, caption: LOW_BOX })));
      await page.evaluate(() => document.fonts.ready);
      return await page.$eval("#cap0 .pill", (pill) => {
        const style = getComputedStyle(pill);
        const text = pill.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
        return { lines: Math.round(text / parseFloat(style.lineHeight)), fontSize: parseFloat(style.fontSize), foot: Math.round(pill.getBoundingClientRect().bottom) };
      });
    } finally {
      await page.close();
    }
  }

  it("wraps past two lines without a limit, its foot still at the anchor", async () => {
    const card = await measureCard(undefined);
    expect(card.lines).toBeGreaterThan(2);
    expect(card.fontSize).toBe(58);
    expect(card.foot).toBe(1920 - 420);
  });

  it("fits two lines with a limit of two, the foot unmoved", async () => {
    const card = await measureCard(2);
    expect(card.lines).toBeLessThanOrEqual(2);
    expect(card.fontSize).toBeLessThan(58);
    expect(card.fontSize).toBeGreaterThanOrEqual(41);
    expect(card.foot).toBe(1920 - 420);
  });
});
