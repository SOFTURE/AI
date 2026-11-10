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
import type { EdlOverlay } from "../src/footage/overlay-schema.js";
import { resolveEdlOverlays, type ResolvedOverlay } from "../src/footage/overlays.js";
import { CHROMIUM_PATH, hasChromium } from "./chromium.js";

/** The render's overlays in a real browser, frame grabs on the composition's own GSAP timeline (issue #1200). */

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
  captionPreset: "reels",
  endCard: null,
};

const OVERLAYS: EdlOverlay[] = [
  { kind: "keyword", at: 0.2, duration: 1.2, text: "3x" },
  { kind: "lower_third", at: 1.5, duration: 1.2, text: "Lisbon, Portugal" },
  { kind: "list", at: 2.8, duration: 1.2, items: ["Cheap", "Sunny"] },
  { kind: "punch_in", at: 4.2, duration: 1.4 },
  { kind: "arrow", at: 5.8, duration: 1, anchor: { x: 800, y: 700 } },
  { kind: "highlight", at: 6.8, duration: 1.2, anchor: { x: 300, y: 500, width: 400, height: 200 } },
];

const EDL: Edl = {
  version: 2,
  film: "street",
  segments: [
    { id: "s1", clip: "talk", start: 0, end: 4, transition: "cut", motion: "none" },
    { id: "s2", clip: "talk", start: 5, end: 9, transition: "zoom", motion: "none" },
  ],
  overlays: OVERLAYS,
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

function getOverlays(): ResolvedOverlay[] {
  const result = resolveEdlOverlays({ film, edl: EDL, words: [], frame: LAYOUTS["9:16"].frame, caption: CAPTION });
  if (!result.ok) throw new Error(result.problems.join("; "));
  return result.overlays;
}

describe.runIf(hasChromium)("overlays in the browser", () => {
  let browser: Browser;
  let page: Page;
  let dir: string;
  const overlays = getOverlays();

  beforeAll(async () => {
    browser = await chromium.launch(CHROMIUM_PATH === undefined ? {} : { executablePath: CHROMIUM_PATH });
    dir = mkdtempSync(join(tmpdir(), "overlays-render-"));
    mkdirSync(join(dir, "assets"));
    copyFileSync(require.resolve("gsap/dist/gsap.min.js"), join(dir, "assets", "gsap.min.js"));
    const file = join(dir, "index.html");
    writeFileSync(
      file,
      composeFootage({
        film,
        edl: EDL,
        words: [],
        frame: LAYOUTS["9:16"].frame,
        caption: CAPTION,
        headlineSize: 96,
        colors: COLORS,
        fonts: { heading: null, body: null },
        assets: { clips: { talk: "clips/talk.mp4" }, picture: "assets/picture.mp4", speech: "assets/speech.mp3", music: null, lastFrame: "assets/last.jpg", logo: null, sfx: {} },
        brandName: "Acme",
        locale: "en-US",
        overlays,
      }),
    );
    page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
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

  /** The frame's pixel at (x, y) as `[r, g, b]`. */
  async function grabPixel(x: number, y: number): Promise<number[]> {
    const png = await page.screenshot({ clip: { x, y, width: 1, height: 1 } });
    return page.evaluate(async (base64) => {
      const image = new Image();
      image.src = `data:image/png;base64,${base64}`;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = 1;
      canvas.height = 1;
      const context = canvas.getContext("2d");
      if (context === null) throw new Error("no 2d context");
      context.drawImage(image, 0, 0);
      return Array.from(context.getImageData(0, 0, 1, 1).data.slice(0, 3));
    }, png.toString("base64"));
  }

  const isNear = (rgb: number[], hex: string): boolean => [1, 3, 5].every((offset, channel) => Math.abs((rgb[channel] ?? 0) - parseInt(hex.slice(offset, offset + 2), 16)) <= 12);

  it("pops the keyword's card in on the brand's background, on its side, inside its box", async () => {
    await seek(0.9);
    const card = await page.$eval("#ov0 .ov-card", (element) => element.getBoundingClientRect().toJSON() as DOMRect);
    const keyword = overlays[0];
    if (keyword?.kind !== "keyword") throw new Error("a keyword");
    expect(Math.round(card.right)).toBe(keyword.box.left + keyword.box.width);
    expect(card.top).toBeGreaterThanOrEqual(keyword.box.top - 1);
    expect(isNear(await grabPixel(Math.round(card.right) - 12, Math.round(card.top + card.height / 2)), COLORS.background)).toBe(true);
  });

  it("shows the lower third and the list's points with their accent dots", async () => {
    await seek(2.3);
    expect(await page.$eval("#ov1t", (element) => getComputedStyle(element).opacity)).toBe("1");
    const dot = await page.$eval("#ov1d", (element) => element.getBoundingClientRect().toJSON() as DOMRect);
    expect(isNear(await grabPixel(Math.round(dot.x + dot.width / 2), Math.round(dot.y + dot.height / 2)), COLORS.accent)).toBe(true);
    await seek(3.6);
    expect(await page.$$eval("#ov2 li", (items) => items.map((item) => getComputedStyle(item).opacity))).toEqual(["1", "1"]);
  });

  it("zooms the picture in for the punch-in and back out after it", async () => {
    const getScale = () => page.$eval("#picture", (element) => new DOMMatrix(getComputedStyle(element).transform).a);
    await seek(4.9);
    expect(await getScale()).toBeCloseTo(1.08 * 1.12, 3);
    await seek(5.7);
    expect(await getScale()).toBeCloseTo(1.08, 3);
  });

  it("draws the arrow up to its point and the highlight round its rectangle, in the accent", async () => {
    await seek(6.5);
    expect(isNear(await grabPixel(797, 697), COLORS.accent)).toBe(true);
    await seek(7.5);
    expect(isNear(await grabPixel(500, 500), COLORS.accent)).toBe(true);
    expect(isNear(await grabPixel(300, 600), COLORS.accent)).toBe(true);
    // Outside the overlays' span the arrow is gone.
    await seek(7.5);
    expect(await page.$eval("#ov4", (element) => getComputedStyle(element).visibility)).toBe("hidden");
  });
});

describe.runIf(hasChromium)("a typed hook title in the browser (RV-131 of an adopting app)", () => {
  const HOOK: EdlOverlay = { kind: "hook_title", at: 0, duration: 6, text: "Effective plans", style: { entrance: "type", typing_speed: 10 } };
  const edl: Edl = { ...EDL, segments: [{ id: "s1", clip: "talk", start: 0, end: 9, transition: "cut", motion: "none" }], overlays: [HOOK] };
  let browser: Browser;
  let page: Page;
  let dir: string;

  beforeAll(async () => {
    const resolved = resolveEdlOverlays({ film, edl, words: [], frame: LAYOUTS["9:16"].frame, caption: CAPTION });
    if (!resolved.ok) throw new Error(resolved.problems.join("; "));
    browser = await chromium.launch(CHROMIUM_PATH === undefined ? {} : { executablePath: CHROMIUM_PATH });
    dir = mkdtempSync(join(tmpdir(), "overlays-typed-"));
    mkdirSync(join(dir, "assets"));
    copyFileSync(require.resolve("gsap/dist/gsap.min.js"), join(dir, "assets", "gsap.min.js"));
    const file = join(dir, "index.html");
    writeFileSync(
      file,
      composeFootage({
        film,
        edl,
        words: [],
        frame: LAYOUTS["9:16"].frame,
        caption: CAPTION,
        headlineSize: 96,
        colors: COLORS,
        fonts: { heading: null, body: null },
        assets: { clips: { talk: "clips/talk.mp4" }, picture: "assets/picture.mp4", speech: "assets/speech.mp3", music: null, lastFrame: "assets/last.jpg", logo: null, sfx: {} },
        brandName: "Acme",
        locale: "en-US",
        overlays: resolved.overlays,
      }),
    );
    page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
    await page.goto(pathToFileURL(file).href);
    await page.evaluate(() => document.fonts.ready);
  });

  afterAll(async () => {
    await browser.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it("keeps the card its fitted size and the typed characters centred in it while it types", async () => {
    const box = (resolveEdlOverlays({ film, edl, words: [], frame: LAYOUTS["9:16"].frame, caption: CAPTION }) as { overlays: ResolvedOverlay[] }).overlays[0];
    if (box?.kind !== "hook_title") throw new Error("a hook title");
    for (const at of [0.65, 1.0, 1.5, 2.0]) {
      await page.evaluate((seconds) => {
        (window as unknown as { __timelines: Record<string, { seek: (t: number) => void }> }).__timelines.film?.seek(seconds);
      }, at);
      const rects = await page.evaluate(() => {
        const card = document.querySelector("#ov0 .ov-card")?.getBoundingClientRect();
        const shown = [...document.querySelectorAll<HTMLElement>("#ov0 .ch")].filter((char) => getComputedStyle(char).opacity === "1").map((char) => char.getBoundingClientRect());
        return { card: card?.toJSON() as DOMRect, left: Math.min(...shown.map((rect) => rect.left)), right: Math.max(...shown.map((rect) => rect.right)), count: shown.length };
      });
      expect(rects.count, `at ${at} s`).toBeGreaterThan(0);
      expect(Math.round(rects.card.width)).toBe(box.box.width);
      const inkCentre = (rects.left + rects.right) / 2;
      expect(Math.abs(inkCentre - (rects.card.left + rects.card.width / 2)) / 1080, `at ${at} s`).toBeLessThanOrEqual(0.02);
    }
  }, 30_000);
});
