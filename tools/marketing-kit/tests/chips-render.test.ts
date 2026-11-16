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
import { getListCardsByItem, getListItemTimes, resolveEdlOverlays, type OverlayBox, type ResolvedOverlay } from "../src/footage/overlays.js";
import { CHROMIUM_PATH, hasChromium } from "./chromium.js";

/**
 * RV-185 of an adopting app: the render's list chips, the ones shown always a row centred on the frame's axis, sliding
 * aside smoothly as each new point comes in, in a real browser on the composition's own GSAP timeline, with the safe
 * zone whose sides differ most (`all`: 60 and 150 px).
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

/** Three points at size l (a row that needs the centred span's smaller type) and four short ones, each said in turn. */
const OVERLAYS: EdlOverlay[] = [
  { kind: "list", at: 0.5, duration: 5, items: ["medication", "date", "who gave it"], item_at: [0.5, 1.6, 2.8], style: { size: "l", list_layout: "chips" } },
  { kind: "list", at: 6.5, duration: 5.5, items: ["rice", "tea", "a bus", "visa"], item_at: [6.5, 7.6, 8.7, 9.8], style: { list_layout: "chips" } },
];

const EDL: Edl = { version: 2, film: "trip", segments: [{ id: "s1", clip: "talk", start: 0, end: 13, transition: "cut", motion: "none" }], overlays: OVERLAYS };

function getLists(): Extract<ResolvedOverlay, { kind: "list" }>[] {
  const result = resolveEdlOverlays({ film, edl: EDL, words: [], frame: FRAME, caption: CAPTION });
  if (!result.ok) throw new Error(result.problems.join("; "));
  return result.overlays.filter((overlay): overlay is Extract<ResolvedOverlay, { kind: "list" }> => overlay.kind === "list");
}

describe.runIf(hasChromium)("list chips in the browser stay centred while the list comes in (RV-185 of an adopting app)", () => {
  let browser: Browser;
  let page: Page;
  let dir: string;
  const lists = getLists();

  beforeAll(async () => {
    browser = await chromium.launch(CHROMIUM_PATH === undefined ? {} : { executablePath: CHROMIUM_PATH });
    dir = mkdtempSync(join(tmpdir(), "chips-render-"));
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
        overlays: lists,
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

  /** The chips of list `index` drawn at this second: shown and not faded out, left to right. */
  async function getShownChips(index: number): Promise<{ left: number; right: number }[]> {
    return page.$$eval(`#ov${index} .ov-chip`, (elements) =>
      elements
        .filter((element) => getComputedStyle(element).visibility === "visible" && Number(getComputedStyle(element).opacity) > 0.01)
        .map((element) => element.getBoundingClientRect())
        .map((rect) => ({ left: rect.left, right: rect.right }))
        .sort((a, b) => a.left - b.left),
    );
  }

  it("resolves both lists as chips, the three points smaller to fit the centred span", () => {
    expect(lists.map((list) => list.chips?.length)).toEqual([3, 4]);
    expect(lists.map((list) => getListItemTimes(list))).toEqual([
      [0.5, 1.6, 2.8],
      [6.5, 7.6, 8.7, 9.8],
    ]);
  });

  it.each([0, 1])("keeps list %i's shown chips centred as a group once each point has come in, each where the draft reports it", async (index) => {
    const list = lists[index] as Extract<ResolvedOverlay, { kind: "list" }>;
    const steps = getListCardsByItem(list);
    const times = getListItemTimes(list);
    for (const [step, at] of times.entries()) {
      const seconds = at + 0.6;
      await seek(seconds);
      const chips = await getShownChips(index);
      expect(chips, `${seconds} s`).toHaveLength(step + 1);
      const left = chips[0]?.left ?? 0;
      const right = chips.at(-1)?.right ?? 0;
      expect(Math.abs(((left + right) / 2 - FRAME.width / 2) / FRAME.width), `${seconds} s: ${left}..${right}`).toBeLessThanOrEqual(0.01);
      // The render draws each chip where `get_draft_frames` reports it.
      (steps[step] as OverlayBox[]).forEach((box, chip) => {
        expect(Math.abs((chips[chip]?.left ?? 0) - box.left), `${seconds} s chip ${chip}`).toBeLessThanOrEqual(1);
      });
    }
  });

  it("slides the shown chips aside smoothly as a new point comes in, never jumping", async () => {
    const list = lists[0] as Extract<ResolvedOverlay, { kind: "list" }>;
    const steps = getListCardsByItem(list);
    const lefts: number[] = [];
    for (const offset of [0, 0.05, 0.1, 0.15, 0.2, 0.3, 0.4]) {
      await seek(1.6 + offset);
      lefts.push(await page.$eval("#ov0c0", (element) => element.getBoundingClientRect().left));
    }
    const [from, to] = [steps[0]?.[0]?.left ?? 0, steps[1]?.[0]?.left ?? 0];
    expect(Math.abs((lefts[0] as number) - from)).toBeLessThanOrEqual(1);
    expect(Math.abs((lefts.at(-1) as number) - to)).toBeLessThanOrEqual(1);
    // Every frame moves the same way, eased out: the steps shrink, and none goes past its place.
    const moves = lefts.slice(1).map((left, at) => left - (lefts[at] as number));
    for (const move of moves) expect(move).toBeLessThanOrEqual(0);
    expect(Math.abs(moves[0] as number)).toBeGreaterThan(Math.abs(moves.at(-1) as number));
    for (const left of lefts) expect(left).toBeGreaterThanOrEqual(to - 1);
  });
  it.each([0, 1])("brings list %i's points in one by one on their seconds, every earlier point ticked, the newest numbered (RV-192)", async (index) => {
    const list = lists[index] as Extract<ResolvedOverlay, { kind: "list" }>;
    const times = getListItemTimes(list);
    for (const [step, at] of times.entries()) {
      // One frame before its second only the earlier chips show; once it is in (the tick drawn), it leads alone.
      if (step > 0) {
        await seek(at - 1 / 30);
        expect(await getShownChips(index), `${at} s, one frame before`).toHaveLength(step);
      }
      await seek(at + 0.45);
      const numbers = await page.$$eval(`#ov${index} .ov-num > i`, (elements) => elements.map((element) => Math.round(Number(getComputedStyle(element).opacity) * 100) / 100));
      const ticks = await page.$$eval(`#ov${index} .ov-num polyline`, (elements) => elements.map((element) => Number(getComputedStyle(element).strokeDashoffset.replace("px", ""))));
      expect(numbers.slice(0, step + 1), `${at} s numbers`).toEqual([...Array.from({ length: step }, () => 0), 1]);
      expect(ticks.slice(0, step), `${at} s ticks`).toEqual(Array.from({ length: step }, () => 0));
    }
  });
});
