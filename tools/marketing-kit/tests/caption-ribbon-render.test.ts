import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { chromium, type Browser, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { LAYOUTS } from "../src/compose/timeline.js";
import { composeFootage, type FootageComposeInput } from "../src/footage/compose.js";
import { CAPTION_RIBBON, DEFAULT_TRANSITIONS, type FootageFilm } from "../src/footage/film.js";
import { CHROMIUM_PATH, hasChromium } from "./chromium.js";

/** The render's ribbon caption in a real browser: one strip per wrapped line, the block turned. */

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
  captionStyle: "ribbon",
  captionKeepWithNext: [],
  endCard: null,
};

function input(tilt: number): FootageComposeInput {
  return {
    film: { ...film, captionRibbonTilt: tilt },
    edl: { version: 2, film: "street", segments: [{ id: "g1", clip: "talk", start: 0, end: 3, transition: "cut", motion: "none" }] },
    words: [
      { text: "three", start: 0.2, end: 0.5 },
      { text: "nights", start: 0.6, end: 0.9 },
      { text: "for", start: 1, end: 1.2 },
      { text: "extraordinarily", start: 1.3, end: 2 },
    ],
    frame: LAYOUTS["9:16"].frame,
    caption: { top: 1300, bottom: 600, left: 150, right: 150, fontSize: 64 },
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
    },
    fonts: { heading: null, body: null },
    assets: { clips: { talk: "clips/talk.mp4" }, speech: "assets/speech.mp3", music: null, lastFrame: "assets/last.jpg", logo: null, sfx: {} },
    brandName: "Acme",
    locale: "en-US",
  };
}

describe.runIf(hasChromium)("a ribbon caption in the browser", () => {
  let browser: Browser;
  let dir: string;

  beforeAll(async () => {
    browser = await chromium.launch(CHROMIUM_PATH === undefined ? {} : { executablePath: CHROMIUM_PATH });
    dir = mkdtempSync(join(tmpdir(), "ribbon-"));
    mkdirSync(join(dir, "assets"));
    copyFileSync(require.resolve("gsap/dist/gsap.min.js"), join(dir, "assets", "gsap.min.js"));
  });

  afterAll(async () => {
    await browser.close();
    rmSync(dir, { recursive: true, force: true });
  });

  /** Opens the composition and seeks its timeline past the card's entrance. */
  async function open(tilt: number): Promise<Page> {
    const file = join(dir, `tilt${String(tilt)}.html`);
    writeFileSync(file, composeFootage(input(tilt)));
    const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
    await page.goto(pathToFileURL(file).href);
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => {
      const timelines = (window as unknown as { __timelines: Record<string, { seek: (t: number) => void }> }).__timelines;
      timelines.film?.seek(1.5);
    });
    return page;
  }

  it("gives each wrapped line a strip of its own, in capitals, padded as the draft pads it", async () => {
    const page = await open(0);
    try {
      const rects = await page.$eval("#cap0 .rb", (span) => [...span.getClientRects()].map((rect) => rect.toJSON() as { left: number; right: number; top: number; bottom: number }));
      expect(rects).toHaveLength(2);
      const [first, second] = [rects[0] ?? { top: 0, bottom: 0 }, rects[1] ?? { top: 0 }];
      // The strips do not touch: the line step is taller than a strip.
      expect(second.top).toBeGreaterThan(first.bottom);
      expect(second.top - first.top).toBeCloseTo(CAPTION_RIBBON.lineHeight * 64, 0);
      expect(await page.$eval("#cap0 .rb", (span) => span.textContent)).toBe("THREE NIGHTS FOR EXTRAORDINARILY");
      expect(await page.$eval("#cap0 .rb", (span) => getComputedStyle(span).paddingLeft)).toBe(`${String(CAPTION_RIBBON.padding.x * 64)}px`);
      expect(await page.$eval("#cap0 .rb", (span) => getComputedStyle(span).backgroundColor)).toBe("rgb(194, 24, 122)");
    } finally {
      await page.close();
    }
  });

  it("turns the block counter-clockwise by its tilt about its middle, keeping its foot's middle in place", async () => {
    const [flat, turned] = [await open(0), await open(5)];
    try {
      const box = (page: Page) => page.$eval("#cap0", (element) => element.getBoundingClientRect().toJSON() as { top: number; bottom: number; left: number; right: number; height: number });
      const [a, b] = [await box(flat), await box(turned)];
      expect(b.height).toBeGreaterThan(a.height + 40);
      expect((b.top + b.bottom) / 2).toBeCloseTo((a.top + a.bottom) / 2, 0);
      // rotate(-5deg): the matrix's second term is -sin 5°, so the block's right end stands higher.
      expect(await turned.$eval("#cap0", (element) => getComputedStyle(element).transform)).toMatch(/^matrix\(0\.996\d*, -0\.087\d*, 0\.087\d*, 0\.996/);
    } finally {
      await flat.close();
      await turned.close();
    }
  });
});
