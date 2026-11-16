import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { LAYOUTS } from "../compose/timeline.js";
import { CAPTION_SAFE_ZONES } from "./captions.js";
import { FOOTAGE_DRAFT_FONT, buildFootageDraftCaptions } from "./draft.js";
import { type Edl } from "./edl.js";
import { DEFAULT_TRANSITIONS, type FootageFilm } from "./film.js";
import { getOverlayMarkup, getPlaceCardTimes } from "./overlay-html.js";
import { type EdlOverlay } from "./overlay-schema.js";
import {
  MIN_OVERLAY_SUBTITLE_PX,
  OVERLAY_LINE_HEIGHT,
  OVERLAY_MARGIN,
  OVERLAY_SUBTITLE_SCALES,
  estimateTextWidth,
  getOverlaySafeZone,
  getTitleContentBox,
  resolveEdlOverlays,
  type ResolveOverlaysInput,
  type ResolvedOverlay,
} from "./overlays.js";
import { readFfmpegListing } from "./tools.js";

/**
 * RV-184 of an adopting app: a place card whose subtitle did not fit the span centred on the frame's axis was measured
 * in the whole safe zone and pushed against its wider (right) side: 8 % margin on the left, 16.1 % on the right. Every
 * place card now sits on the frame's axis, whatever its title (up to 28 characters), subtitle (up to 40) and sizes.
 */

type Preset = keyof typeof CAPTION_SAFE_ZONES;

const filmFor = (captionPreset: Preset): FootageFilm => ({
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
  captionPreset,
  endCard: null,
});

const FRAME = LAYOUTS["9:16"].frame;
const CAPTION = { top: 1290, bottom: 420, left: 120, right: 120, fontSize: 64 };
const COLORS = { background: "#1d1a2b", foreground: "#fdf7f2", accent: "#e8336b" };
const edlWith = (overlays: EdlOverlay[]): Edl => ({ version: 2, film: "trip", segments: [{ id: "s1", clip: "talk", start: 0, end: 30, transition: "cut", motion: "none" }], overlays });

function resolve(overlays: EdlOverlay[], preset: Preset = "all", changes: Partial<ResolveOverlaysInput> = {}) {
  return resolveEdlOverlays({ film: filmFor(preset), edl: edlWith(overlays), words: [], frame: FRAME, caption: CAPTION, ...changes });
}

function place(overlay: EdlOverlay, preset: Preset = "all"): Extract<ResolvedOverlay, { kind: "place_card" }> {
  const result = resolve([overlay], preset);
  if (!result.ok) throw new Error(result.problems.join("; "));
  const [first] = result.overlays;
  if (first?.kind !== "place_card") throw new Error("expected a place card");
  return first;
}

/** How far a box's middle is from the frame's axis, in per cent of the frame's width (the drafts' `box_percent`). */
const offAxisPercent = (box: { left: number; width: number }): number => ((box.left + box.width / 2 - FRAME.width / 2) / FRAME.width) * 100;

/** The owner's card, with fictional text of the same length: a short title and a 22-character subtitle, size l. */
const OWNER_CARD: EdlOverlay = {
  kind: "place_card",
  at: 1,
  duration: 3,
  text: "Kenya",
  subtitle: "yellow fever card book",
  style: { position: "top", size: "l", subtitle_size: "m", pin: "drop", subtitle_delay: 0.3 },
};

/** Subtitles of 10, 20, 30 and 40 characters, and titles up to the schema's 28. */
const SUBTITLES = ["Old harbor", "A bay of 1600 rocks", "Thousands of islands in a bay", "Thousands of limestone islands in a bay!"];
const TITLES = ["Kenya", "Ha Long Bay", "Cat Ba and Lan Ha bays", "The old quarter of Hoi An ok"];

describe("a place card on the frame's axis (RV-184 of an adopting app)", () => {
  it("measures the fixtures at the lengths the item names", () => {
    expect(SUBTITLES.map((subtitle) => [...subtitle].length)).toEqual([10, 19, 29, 40]);
    expect([...(TITLES[3] as string)].length).toBe(28);
    expect([...(OWNER_CARD.subtitle as string)].length).toBe(22);
  });

  it("centres the owner's card instead of pushing it against the right side of the safe zone", () => {
    const card = place(OWNER_CARD);
    expect(Math.abs(card.box.left + card.box.width / 2 - FRAME.width / 2)).toBeLessThanOrEqual(0.5);
    const zone = getOverlaySafeZone(filmFor("all"), FRAME);
    expect(card.box.left).toBeGreaterThanOrEqual(zone.right + OVERLAY_MARGIN);
    expect(card.box.left + card.box.width).toBeLessThanOrEqual(FRAME.width - zone.right - OVERLAY_MARGIN);
    // Its subtitle stays one line, a little smaller than before (the s step's 50 px could not fit the centred span).
    expect(card.subtitleLines).toBeUndefined();
    expect(card.subtitleFontSize).toBe(47);
    expect(card.subtitleFontSize).toBeGreaterThanOrEqual(MIN_OVERLAY_SUBTITLE_PX);
    expect(card.fontSize).toBe(118);
  });

  it("keeps every card on the axis within 1 % for subtitles of 10 to 40 characters, every size, pin and preset", () => {
    const misses: string[] = [];
    for (const preset of Object.keys(CAPTION_SAFE_ZONES) as Preset[]) {
      for (const text of TITLES) {
        for (const subtitle of SUBTITLES) {
          for (const size of ["s", "m", "l"] as const) {
            for (const subtitleSize of ["s", "m", "l"] as const) {
              for (const pin of ["none", "drop"] as const) {
                const overlay: EdlOverlay = { kind: "place_card", at: 1, duration: 3, text, subtitle, style: { position: "top", size, subtitle_size: subtitleSize, pin } };
                const result = resolve([overlay], preset);
                const label = `${preset} ${text} / ${subtitle} ${size}/${subtitleSize} pin ${pin}`;
                if (!result.ok) misses.push(`${label}: ${result.problems.join("; ")}`);
                else {
                  const [card] = result.overlays;
                  if (card?.kind !== "place_card" || Math.abs(offAxisPercent(card.box)) > 1) misses.push(`${label}: off the axis`);
                }
              }
            }
          }
        }
      }
    }
    expect(misses).toEqual([]);
  });

  it("wraps a subtitle too long for one line into two balanced lines that keep the card in the centred span", () => {
    const card = place({ ...OWNER_CARD, subtitle: SUBTITLES[3] });
    expect(card.subtitleLines).toEqual(["Thousands of limestone", "islands in a bay!"]);
    expect(card.subtitle).toBe(SUBTITLES[3]);
    expect(Math.abs(offAxisPercent(card.box))).toBeLessThanOrEqual(0.05);
    // Each line no wider than the text block, the block inside the card; the second line adds one card line.
    const content = getTitleContentBox(card);
    for (const line of card.subtitleLines ?? []) expect(estimateTextWidth(line, card.subtitleFontSize)).toBeLessThanOrEqual(content.width);
    expect(content.left).toBeGreaterThanOrEqual(card.box.left);
    expect(content.left + content.width).toBeLessThanOrEqual(card.box.left + card.box.width);
    const one = place({ ...OWNER_CARD, subtitle: "Thousands" });
    const oneHeight = getTitleContentBox(one).height - one.subtitleFontSize * 1.3;
    expect(content.height - card.subtitleFontSize * (1.3 + OVERLAY_LINE_HEIGHT)).toBeCloseTo(oneHeight, 6);
    // Never under the s step of its title, nor under `MIN_OVERLAY_SUBTITLE_PX` when the s step is above it.
    expect(card.subtitleFontSize).toBeGreaterThanOrEqual(Math.min(MIN_OVERLAY_SUBTITLE_PX, Math.round(118 * OVERLAY_SUBTITLE_SCALES.s)));
  });

  it("shrinks a long title further in the centred span rather than placing it off the axis", () => {
    const card = place({ kind: "place_card", at: 1, duration: 3, text: TITLES[3], subtitle: "Old harbor", style: { size: "l" } });
    expect(card.lines).toEqual(["The old quarter", "of Hoi An ok"]);
    expect(card.fontSize).toBe(69);
    expect(Math.abs(offAxisPercent(card.box))).toBeLessThanOrEqual(0.05);
  });

  it("keeps a card that fitted the centred span exactly as it was", () => {
    const card = place({ ...OWNER_CARD, text: "Thailand", subtitle: "Old harbor" });
    expect(card.box).toEqual({ left: 205, top: 220, width: 671, height: 376 });
    expect([card.fontSize, card.subtitleFontSize, card.subtitleLines]).toEqual([118, 65, undefined]);
    const reels = place({ kind: "place_card", at: 1, duration: 3, text: "Ha Long Bay", subtitle: "A bay of 1600 islands" }, "reels");
    expect(reels.subtitleFontSize).toBe(51);
    expect(reels.subtitleLines).toBeUndefined();
  });

  it("still refuses, never places off the axis, a one-word title too long for two lines", () => {
    expect(resolve([{ kind: "place_card", at: 1, duration: 3, text: "Supercalifragilisticexpialid", subtitle: "Old harbor", style: { size: "l" } }])).toEqual({
      ok: false,
      problems: ["overlays[0]: the place card takes more than 2 lines even at a smaller size; shorten it or use a smaller size"],
    });
    expect(resolve([{ kind: "place_card", at: 1, duration: 3, text: "Kenya", subtitle: "Supercalifragilisticexpialidocious-a-lot", style: { size: "l" } }])).toEqual({
      ok: false,
      problems: ["overlays[0]: the place card's subtitle is too wide for one line; shorten it or use a smaller size"],
    });
  });
});

describe("a wrapped subtitle in the draft and the render", () => {
  const WRAPPED: EdlOverlay = { ...OWNER_CARD, subtitle: SUBTITLES[3], style: { position: "top", size: "l", subtitle_size: "m" } };

  it("draws the draft's two subtitle lines on the card's axis, one card line apart, from the subtitle's time", () => {
    const card = place(WRAPPED);
    const ass = buildFootageDraftCaptions({ film: { ...filmFor("all"), captions: false }, edl: edlWith([WRAPPED]), words: [], caption: CAPTION, frame: FRAME, overlays: [card], overlayColors: COLORS }) ?? "";
    const centre = Math.round(card.box.left + card.box.width / 2);
    const subtitleLines = ass.split("\n").filter((line) => line.startsWith("Dialogue: 4") && line.includes(`\\fs${card.subtitleFontSize}`));
    expect(subtitleLines).toHaveLength(2);
    // The slide entrance moves each line up to its place: `\move(x, y below, x, y)`, x on the card's axis.
    const positions = subtitleLines.map((line) => /\\move\(([\d.]+),([\d.]+),([\d.]+),([\d.]+)/.exec(line)?.slice(1).map(Number) ?? []);
    expect(positions.map(([fromX, , toX]) => [Math.round(fromX ?? 0), Math.round(toX ?? 0)])).toEqual([
      [centre, centre],
      [centre, centre],
    ]);
    expect(Math.abs((positions[1]?.[3] ?? 0) - (positions[0]?.[3] ?? 0) - card.subtitleFontSize * OVERLAY_LINE_HEIGHT)).toBeLessThanOrEqual(1);
    expect(subtitleLines[0]).toContain("Thousands of limestone");
    expect(subtitleLines[1]).toContain("islands in a bay!");
  });

  it("breaks the render's subtitle between its lines, escaped", () => {
    const card = place({ ...WRAPPED, subtitle: "Islands <b> & rocks of the bay in Kenya" });
    const html = getOverlayMarkup([card], { colors: COLORS, headingFont: "Head", frame: FRAME }).html.join("");
    expect(html).toContain(`<div class="ov-sub" style="font-size:${card.subtitleFontSize}px">Islands &lt;b&gt; &amp; rocks<br>of the bay in Kenya</div>`);
    const plain = place(OWNER_CARD);
    expect(getOverlayMarkup([plain], { colors: COLORS, headingFont: "Head", frame: FRAME }).html.join("")).toContain(`px">yellow fever card book</div>`);
  });
});

const canBurn = (() => {
  const run = spawnSync("ffmpeg", ["-hide_banner", "-filters"], { encoding: "utf8" });
  return run.status === 0 && readFfmpegListing(run.stdout).has("ass");
})();

describe.skipIf(!canBurn)("a place card burned in by libass stays on the axis on every frame of its animation", () => {
  let dir = "";
  afterEach(() => {
    if (dir !== "") rmSync(dir, { recursive: true, force: true });
    dir = "";
  });

  /** The burned frame at `seconds` as raw RGB, on a plain blue picture. */
  function grabFrame(overlay: EdlOverlay, seconds: number): Buffer {
    dir = dir === "" ? mkdtempSync(join(tmpdir(), "place-card-centred-")) : dir;
    const card = place(overlay);
    const ass = buildFootageDraftCaptions({ film: { ...filmFor("all"), captions: false }, edl: edlWith([overlay]), words: [], caption: CAPTION, frame: FRAME, overlays: [card], overlayColors: COLORS }) ?? "";
    writeFileSync(join(dir, "captions.ass"), ass);
    mkdirSync(join(dir, "fonts"), { recursive: true });
    copyFileSync(FOOTAGE_DRAFT_FONT.file, join(dir, "fonts", basename(FOOTAGE_DRAFT_FONT.file)));
    const run = spawnSync(
      "ffmpeg",
      ["-v", "error", "-f", "lavfi", "-i", `color=c=0x3366aa:s=${FRAME.width}x${FRAME.height}:d=10:r=30`, "-ss", String(seconds), "-vf", "ass=captions.ass:fontsdir=fonts", "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
      { cwd: dir, maxBuffer: FRAME.width * FRAME.height * 3 + 1024 },
    );
    expect(run.status, run.stderr.toString()).toBe(0);
    return run.stdout;
  }

  /** The leftmost and rightmost columns where anything is drawn over the blue picture, in the rows of the card. */
  function findDrawn(frame: Buffer, rows: { top: number; bottom: number }): { left: number; right: number } | null {
    let [left, right] = [Infinity, -Infinity];
    for (let y = Math.max(0, rows.top); y < Math.min(FRAME.height, rows.bottom); y += 2) {
      for (let x = 0; x < FRAME.width; x++) {
        const at = (y * FRAME.width + x) * 3;
        const distance = Math.abs((frame[at] ?? 0) - 0x33) + Math.abs((frame[at + 1] ?? 0) - 0x66) + Math.abs((frame[at + 2] ?? 0) - 0xaa);
        if (distance > 60) [left, right] = [Math.min(left, x), Math.max(right, x)];
      }
    }
    return left === Infinity ? null : { left, right };
  }

  it.each([
    ["the owner's card", OWNER_CARD],
    ["a wrapped 40-character subtitle", { ...OWNER_CARD, subtitle: SUBTITLES[3] }],
  ])("centres %s from its entrance through its subtitle to its exit", (_name, overlay) => {
    const card = place(overlay);
    const times = getPlaceCardTimes(card);
    const moments = [card.start + 0.08, card.start + 0.2, times.title + 0.05, (times.subtitle ?? card.start) + 0.1, card.start + 1.6, card.end - 0.1];
    const rows = { top: card.box.top - 40, bottom: card.box.top + card.box.height + 40 };
    for (const seconds of moments) {
      const drawn = findDrawn(grabFrame(overlay, seconds), rows);
      expect(drawn, `frame at ${seconds} s`).not.toBeNull();
      const middle = ((drawn?.left ?? 0) + (drawn?.right ?? 0) + 1) / 2;
      expect(Math.abs((middle - FRAME.width / 2) / FRAME.width), `frame at ${seconds} s: ${drawn?.left}..${drawn?.right}`).toBeLessThanOrEqual(0.01);
    }
  });
});
