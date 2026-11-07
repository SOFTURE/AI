import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { chromium, type Browser, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { LAYOUTS } from "../src/compose/timeline.js";
import { composeFootage, type FootageComposeInput } from "../src/footage/compose.js";
import { DEFAULT_TRANSITIONS, type CaptionHighlightStyle, type FootageFilm } from "../src/footage/film.js";
import { CHROMIUM_PATH, hasChromium } from "./chromium.js";

/** The render's box highlight in a real browser, on the composition's own GSAP timeline (issue #1199). */

const require = createRequire(import.meta.url);

const film: FootageFilm = {
  id: "street",
  title: "Street",
  format: "9:16",
  language: "en",
  clips: [],
  isolateVoice: false,
  cut: { fillers: [], pauseSeconds: 0.6, padSeconds: 0.1, maxSeconds: null },
  transitions: DEFAULT_TRANSITIONS,
  music: { source: { kind: "none" }, volume: 0.35, duckedVolume: 0.1 },
  captions: true,
  captionStyle: "highlight",
  endCard: null,
};

function input(style: CaptionHighlightStyle): FootageComposeInput {
  return {
    film: { ...film, captionHighlightStyle: style },
    edl: { version: 2, film: "street", segments: [{ id: "g1", clip: "talk", start: 0, end: 3, transition: "cut", motion: "none" }] },
    words: [
      { text: "hello", start: 0.2, end: 0.5 },
      { text: "brave", start: 1, end: 1.4 },
      { text: "world", start: 2, end: 2.4 },
    ],
    frame: LAYOUTS["9:16"].frame,
    caption: { top: 1400, left: 80, right: 80, fontSize: 64 },
    headlineSize: 96,
    colors: {
      background: "#0c0c0d",
      foreground: "#f2f3f5",
      muted: "#a3a6ad",
      accent: "#cff26b",
      cta: "#2dd4bf",
      onCta: "#0c0c0d",
      captionBackground: "#c2187a",
      captionText: "#ffffff",
      captionHighlight: "#ff8a00",
      captionHighlightBox: "#ff8a00",
      captionHighlightText: "#111111",
    },
    fonts: { heading: null, body: null },
    assets: { clips: { talk: "clips/talk.mp4" }, speech: "assets/speech.mp3", music: null, lastFrame: "assets/last.jpg", logo: null, sfx: {} },
    brandName: "Acme",
    locale: "en-US",
  };
}

describe.runIf(hasChromium)("a box highlight in the browser", () => {
  let browser: Browser;
  let dir: string;

  beforeAll(async () => {
    browser = await chromium.launch(CHROMIUM_PATH === undefined ? {} : { executablePath: CHROMIUM_PATH });
    dir = mkdtempSync(join(tmpdir(), "highlight-box-"));
    mkdirSync(join(dir, "assets"));
    copyFileSync(require.resolve("gsap/dist/gsap.min.js"), join(dir, "assets", "gsap.min.js"));
  });

  afterAll(async () => {
    await browser.close();
    rmSync(dir, { recursive: true, force: true });
  });

  /** Opens the composition and seeks its timeline to `seconds`. */
  async function open(style: CaptionHighlightStyle, seconds: number): Promise<Page> {
    const file = join(dir, `${style}.html`);
    writeFileSync(file, composeFootage(input(style)));
    const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
    await page.goto(pathToFileURL(file).href);
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate((at) => {
      const timelines = (window as unknown as { __timelines: Record<string, { seek: (t: number) => void }> }).__timelines;
      timelines.film?.seek(at);
    }, seconds);
    return page;
  }

  /** The words' boxes in px, in the order they are said. */
  const getWordRects = (page: Page) => page.$$eval("#cap0 .pill > span", (spans) => spans.map((span) => span.getBoundingClientRect().toJSON() as { left: number; right: number; top: number; bottom: number }));

  /** The frame's pixels across the pill's rows, as `[r, g, b, a]` per pixel. */
  async function grabPillRows(page: Page): Promise<{ rgba: number[]; width: number; top: number; height: number }> {
    const pill = await page.$eval("#cap0 .pill", (element) => element.getBoundingClientRect().toJSON() as { top: number; height: number });
    const top = Math.floor(pill.top);
    const height = Math.ceil(pill.height);
    const png = await page.screenshot({ clip: { x: 0, y: top, width: 1080, height } });
    const pixels = await page.evaluate(async (base64) => {
      const image = new Image();
      image.src = `data:image/png;base64,${base64}`;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext("2d");
      if (context === null) throw new Error("no 2d context");
      context.drawImage(image, 0, 0);
      return Array.from(context.getImageData(0, 0, image.width, image.height).data);
    }, png.toString("base64"));
    return { rgba: pixels, width: 1080, top, height };
  }

  /** The columns holding the box colour (orange), or null when none does. */
  function findBoxColumns(grab: { rgba: number[]; width: number; height: number }): { left: number; right: number } | null {
    let left = grab.width;
    let right = -1;
    for (let y = 0; y < grab.height; y += 1) {
      for (let x = 0; x < grab.width; x += 1) {
        const at = (y * grab.width + x) * 4;
        const [r, g, b] = [grab.rgba[at] ?? 0, grab.rgba[at + 1] ?? 0, grab.rgba[at + 2] ?? 0];
        if (Math.abs(r - 0xff) > 8 || Math.abs(g - 0x8a) > 8 || b > 8) continue;
        left = Math.min(left, x);
        right = Math.max(right, x);
      }
    }
    return right < 0 ? null : { left, right };
  }

  it("draws the box behind the lit word only, its text in the box text colour", async () => {
    const page = await open("box", 1.15);
    try {
      const rects = await getWordRects(page);
      const brave = rects[1];
      expect(brave).toBeDefined();
      if (brave === undefined) return;
      const box = findBoxColumns(await grabPillRows(page));
      expect(box).not.toBeNull();
      if (box === null) return;
      // The box reaches about 0.15 em (10 px at 64 px) past the word on each side and no further.
      expect(box.left).toBeGreaterThanOrEqual(Math.floor(brave.left) - 12);
      expect(box.left).toBeLessThanOrEqual(Math.ceil(brave.left) - 8);
      expect(box.right).toBeLessThanOrEqual(Math.ceil(brave.right) + 12);
      expect(box.right).toBeGreaterThanOrEqual(Math.floor(brave.right) + 8);
      expect(await page.$eval("#cw0_1", (span) => getComputedStyle(span).color)).toBe("rgb(17, 17, 17)");
      expect(await page.$eval("#cw0_0", (span) => getComputedStyle(span).color)).toBe("rgb(255, 255, 255)");
    } finally {
      await page.close();
    }
  });

  it("draws no box once the word's hold has passed", async () => {
    const page = await open("box", 1.7);
    try {
      expect(findBoxColumns(await grabPillRows(page))).toBeNull();
    } finally {
      await page.close();
    }
  });

  it("keeps every word where the text highlight puts it", async () => {
    const [boxPage, textPage] = [await open("box", 1.15), await open("text", 1.15)];
    try {
      expect(await getWordRects(boxPage)).toEqual(await getWordRects(textPage));
    } finally {
      await boxPage.close();
      await textPage.close();
    }
  });
});
