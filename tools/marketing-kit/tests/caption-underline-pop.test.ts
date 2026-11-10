import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { chromium, type Browser, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { LAYOUTS } from "../src/compose/timeline.js";
import { composeFootage, type FootageComposeInput } from "../src/footage/compose.js";
import { DEFAULT_TRANSITIONS, type FootageFilm } from "../src/footage/film.js";
import { CHROMIUM_PATH, hasChromium } from "./chromium.js";

/** The render's underlined lit word and the pill's pop entrance in a real browser, on the composition's own timeline. */

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
  captionHighlightStyle: "underline",
  captionEntrance: "pop",
  endCard: null,
};

function input(): FootageComposeInput {
  return {
    film,
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
      captionBackground: "#111111",
      captionText: "#ffffff",
      captionHighlight: "#ff8a00",
    },
    fonts: { heading: null, body: null },
    assets: { clips: { talk: "clips/talk.mp4" }, speech: "assets/speech.mp3", music: null, lastFrame: "assets/last.jpg", logo: null, sfx: {} },
    brandName: "Acme",
    locale: "en-US",
  };
}

type Rect = { left: number; right: number; top: number; bottom: number; width: number };

describe.runIf(hasChromium)("an underlined lit word and a popping pill in the browser", () => {
  let browser: Browser;
  let dir: string;
  let page: Page;

  beforeAll(async () => {
    browser = await chromium.launch(CHROMIUM_PATH === undefined ? {} : { executablePath: CHROMIUM_PATH });
    dir = mkdtempSync(join(tmpdir(), "caption-underline-"));
    mkdirSync(join(dir, "assets"));
    copyFileSync(require.resolve("gsap/dist/gsap.min.js"), join(dir, "assets", "gsap.min.js"));
    const file = join(dir, "film.html");
    writeFileSync(file, composeFootage(input()));
    page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
    await page.goto(pathToFileURL(file).href);
    await page.evaluate(() => document.fonts.ready);
  });

  afterAll(async () => {
    await browser.close();
    rmSync(dir, { recursive: true, force: true });
  });

  async function seek(seconds: number): Promise<void> {
    await page.evaluate((at) => {
      const timelines = (window as unknown as { __timelines: Record<string, { seek: (t: number) => void }> }).__timelines;
      timelines.film?.seek(at);
    }, seconds);
  }

  const getRect = (selector: string) => page.$eval(selector, (element) => element.getBoundingClientRect().toJSON() as Rect);
  const getOpacity = (selector: string) => page.$eval(selector, (element) => Number(getComputedStyle(element).opacity));

  it("shows the bar under the lit word only, as wide as the word, below its letters, and the word keeps its colour", async () => {
    await seek(1.15);
    const word = await getRect("#cw0_1");
    const bar = await getRect("#cu0_1");
    expect(await getOpacity("#cu0_1")).toBe(1);
    expect(await getOpacity("#cu0_0")).toBe(0);
    expect(await getOpacity("#cu0_2")).toBe(0);
    expect(bar.left).toBeCloseTo(word.left, 0);
    expect(bar.right).toBeCloseTo(word.right, 0);
    // 1 em below the span's top, about 6 px thick at 64 px, inside the 1.18 em line.
    expect(bar.top - word.top).toBeCloseTo(64, 0);
    expect(bar.bottom).toBeLessThanOrEqual(word.bottom);
    expect(await page.$eval("#cw0_1", (span) => getComputedStyle(span).color)).toBe("rgb(255, 255, 255)");
  });

  it("hides the bar once the word's hold has passed", async () => {
    await seek(1.7);
    expect(await getOpacity("#cu0_1")).toBe(0);
  });

  it("grows the pill to its full size without ever passing it", async () => {
    await seek(2.9);
    const full = (await getRect("#cap0 .pill")).width;
    // The first chunk enters at 0.15 s and lasts 0.16 s: sample it every 10 ms and after it.
    const widths: number[] = [];
    for (let at = 0.15; at <= 0.4; at += 0.01) {
      await seek(at);
      widths.push((await getRect("#cap0 .pill")).width);
    }
    expect(Math.max(...widths)).toBeLessThanOrEqual(full + 0.01);
    expect(widths[0]).toBeCloseTo(full * 0.96, 0);
    expect(widths.at(-1)).toBeCloseTo(full, 2);
  });
});
