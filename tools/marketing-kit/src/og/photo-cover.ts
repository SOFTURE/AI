import { readFileSync } from "node:fs";

import { Resvg } from "@resvg/resvg-js";
import jpeg from "jpeg-js";
import satori from "satori";
import { z } from "zod";

import { getContrastRatio, getRelativeLuminance, type BrandColors } from "../config/colors.js";
import { h, type OgNode } from "./element.js";
import { pickWeight, toFontFamilyCss, type OgFonts } from "./fonts.js";
import { describeCharacter, findMissingGlyphs } from "./glyphs.js";
import { toOpaqueHex, withAlpha } from "./palette.js";
import { getCoverCrop, getOrientationMatrix, getOrientedSize, readPhotoInfo, type FocusPoint } from "./photo.js";
import { err, ok, type OgResult } from "./result.js";

/**
 * A publish-ready cover for a vertical video from a photo the owner picks: the photo scaled to cover the frame and
 * cropped around a focus point (EXIF orientation applied), and optional text in the brand's display font laid out by
 * one of `PHOTO_COVER_LAYOUTS`, kept inside the centre 4:5 band the platforms keep when they crop the cover for the
 * profile grid. Satori lays the text out, resvg draws the whole cover, `jpeg-js` encodes it: no network, no system
 * fonts.
 */

/** A Reels, Shorts and TikTok cover. */
export const PHOTO_COVER_SIZE: readonly [number, number] = [1080, 1920];

export const PHOTO_COVER_QUALITY = 90;

/** The longest caption accepted before layout; whether a shorter one fits is measured on the drawn caption. */
export const MAX_COVER_CAPTION_LENGTH = 80;

/** The longest kicker (the small line above the title in `kicker-title`). */
export const MAX_COVER_KICKER_LENGTH = 40;

/** The longest label of the `pill` layout (the caption set in a rounded box). */
export const MAX_COVER_PILL_LENGTH = 32;

/**
 * Where the cover's text goes. `photo`: no text. `title-bottom`, `title-center`, `title-top`: the caption in the lower
 * half, the middle third or the upper half of the band. `kicker-title`: a small kicker line above the caption, in the
 * lower half. `pill`: the caption as a short label in a rounded box, in the lower half.
 */
export const PHOTO_COVER_LAYOUTS = ["photo", "title-bottom", "title-center", "title-top", "kicker-title", "pill"] as const;

export type PhotoCoverLayout = (typeof PHOTO_COVER_LAYOUTS)[number];

/**
 * How the accent is drawn on `kicker-title` (issue #1199): `text` colours the kicker; `box` sets the kicker on an
 * opaque accent box in the better-reading of the light and dark colour; `auto` draws text when the accent reads as
 * text (3:1 against the scrim) and a box when it does not. The `pill` accent is a box whatever the style.
 */
export const PHOTO_COVER_ACCENT_STYLES = ["text", "box", "auto"] as const;

export type PhotoCoverAccentStyle = (typeof PHOTO_COVER_ACCENT_STYLES)[number];

/** `light`: light text over a dark scrim. `dark`: dark text over a light scrim. */
export type PhotoCoverTone = "light" | "dark";

/** Sizes in this file are written for a 1080 px wide band and scaled with its width. */
const BAND_BASE_WIDTH = 1080;
const CAPTION_SIDE_PADDING = 80;
const CAPTION_BOTTOM_PADDING = 120;
const CAPTION_TOP_PADDING = 120;
const KICKER_SIZE = 44;
const KICKER_GAP = 20;
/** The boxed kicker's padding (vertical, horizontal) and corner radius. */
const KICKER_BOX_PADDING: readonly [number, number] = [10, 24];
const KICKER_BOX_RADIUS = 14;
const PILL_SIZE = 56;
const PILL_PADDING: readonly [number, number] = [22, 48];
/** The pill box's opacity: the box is the pill's scrim. */
const PILL_ALPHA = 0xd9;
/** A pixel whose alpha is above this counts as drawn when the caption is measured (the shadow's faint fringe does not). */
const DRAWN_ALPHA = 16;
/** The scrim's opacity at the band's lower edge and below it. */
const SCRIM_ALPHA = 0x8c;
/** The least contrast the accent keeps against what it stands on: the WCAG bound for large text. */
export const MIN_COVER_ACCENT_CONTRAST = 3;

/** The centre 4:5 band of a cover, in pixels. */
export interface CoverBand {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** The widest 4:5 rectangle centred in a frame of `size`. */
export function getCoverBand(size: readonly [number, number]): CoverBand {
  const [width, height] = size;
  const bandWidth = Math.min(width, Math.floor((height * 4) / 5));
  const bandHeight = Math.min(height, Math.round((bandWidth * 5) / 4));
  return { left: Math.floor((width - bandWidth) / 2), top: Math.floor((height - bandHeight) / 2), width: bandWidth, height: bandHeight };
}

/** The caption size at a 1080 px band: shorter captions get bigger type. */
export function getCoverCaptionSize(caption: string): number {
  if (caption.length <= 16) return 112;
  if (caption.length <= 32) return 96;
  return 80;
}

const coverOptionsSchema = z.object({
  photo: z.union([z.string().min(1), z.instanceof(Buffer)]),
  size: z.tuple([z.number().int().min(64).max(4096), z.number().int().min(64).max(4096)]).default([...PHOTO_COVER_SIZE] as [number, number]),
  focus: z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }).default({ x: 0.5, y: 0.5 }),
  layout: z.enum(PHOTO_COVER_LAYOUTS).optional(),
  caption: z
    .string()
    .trim()
    .min(1, "the caption is empty; leave it out for a cover without one")
    .max(MAX_COVER_CAPTION_LENGTH, `the caption is longer than ${String(MAX_COVER_CAPTION_LENGTH)} characters`)
    .optional(),
  kicker: z
    .string()
    .trim()
    .min(1, "the kicker is empty")
    .max(MAX_COVER_KICKER_LENGTH, `the kicker is longer than ${String(MAX_COVER_KICKER_LENGTH)} characters`)
    .optional(),
  tone: z.enum(["light", "dark"]).optional(),
  accent: z.boolean().optional(),
  accentStyle: z.enum(PHOTO_COVER_ACCENT_STYLES).optional(),
  quality: z.number().int().min(1).max(100).default(PHOTO_COVER_QUALITY),
});

export interface PhotoCoverInput {
  /** A JPEG or PNG: its path, or its bytes. */
  photo: string | Buffer;
  /** The cover's size; 1080×1920 by default. */
  size?: readonly [number, number];
  /** The point of the upright photo to keep in view, as fractions of its width and height; the centre by default. */
  focus?: FocusPoint;
  /** Where the text goes (`PHOTO_COVER_LAYOUTS`); `title-bottom` with a caption and `photo` without one by default. */
  layout?: PhotoCoverLayout;
  /** The title (2 to 6 words fit best), or the `pill` label; required by every layout but `photo`, refused by it. */
  caption?: string;
  /** The small line above the title; required by `kicker-title` and refused by the other layouts. */
  kicker?: string;
  /** `light` text over a dark scrim, or `dark` text over a light one; `light` by default. */
  tone?: PhotoCoverTone;
  /**
   * Draws the brand's `accent` colour: the kicker of `kicker-title` in it, or the `pill` box in it (opaque) with the
   * label in `foreground` or `background`, whichever reads better. Refused by the other layouts, and refused when the
   * accent's contrast against what it stands on is under 3:1. Off by default.
   */
  accent?: boolean;
  /** How the accent is drawn (`PHOTO_COVER_ACCENT_STYLES`); `text` by default. Needs `accent: true`. */
  accentStyle?: PhotoCoverAccentStyle;
  /** The light colour is the lighter of `foreground` and `background`, the dark colour the darker. */
  colors: BrandColors;
  /** The brand's fonts (`loadOgFonts`); the text is set in the heading (display) family. */
  fonts: OgFonts;
  /** JPEG quality, 1-100; 90 by default. */
  quality?: number;
  /** Names the cover in errors, e.g. the video's id. */
  id?: string;
}

/** A box on the cover, in pixels: `left` and `top` included, `right` and `bottom` excluded. */
export interface CoverBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** A point on the cover, in pixels from its top left corner. */
export interface CoverPoint {
  x: number;
  y: number;
}

export interface PhotoCover {
  /** A baseline JPEG of exactly `width` × `height`, without an ICC profile (sRGB). */
  jpeg: Buffer;
  width: number;
  height: number;
  bytes: number;
  /** The drawn text's bounds on the cover, its shadow included (the box the fit check measured); null for layout `photo`. */
  textBox: CoverBox | null;
  /** Where the focus point landed on the cover after the crop; off-centre when the photo's edge stops the shift. */
  focusPoint: CoverPoint;
  /**
   * How the accent was drawn and the contrast it reads at (the kicker text against the scrim, or the text on the
   * accent box); null without the accent.
   */
  accent: { style: "text" | "box"; contrast: number } | null;
}

/** The text a cover draws, by layout. */
type CoverText =
  | { layout: "title-bottom" | "title-center" | "title-top"; caption: string }
  | { layout: "kicker-title"; caption: string; kicker: string }
  | { layout: "pill"; caption: string };

type CoverRegion = "lower half" | "upper half" | "middle third";

/** The part of the band each text layout keeps to. */
const LAYOUT_REGIONS: Record<CoverText["layout"], CoverRegion> = {
  "title-bottom": "lower half",
  "title-center": "middle third",
  "title-top": "upper half",
  "kicker-title": "lower half",
  pill: "lower half",
};

/** The rows of `region` in the band: `top` included, `bottom` excluded. */
function getRegionRows(band: CoverBand, region: CoverRegion): { top: number; bottom: number } {
  const bandBottom = band.top + band.height;
  if (region === "lower half") return { top: band.top + Math.floor(band.height / 2), bottom: bandBottom };
  if (region === "upper half") return { top: band.top, bottom: band.top + Math.floor(band.height / 2) };
  return { top: band.top + Math.floor(band.height / 3), bottom: band.top + Math.floor((2 * band.height) / 3) };
}

/** The text the options ask for, or an error when the layout and the texts do not go together. */
function resolveCoverText(options: {
  layout?: PhotoCoverLayout | undefined;
  caption?: string | undefined;
  kicker?: string | undefined;
  accent?: boolean | undefined;
  accentStyle?: PhotoCoverAccentStyle | undefined;
}): OgResult<CoverText | null> {
  const { caption, kicker } = options;
  const layout = options.layout ?? (caption === undefined ? "photo" : "title-bottom");
  if (options.accentStyle !== undefined && options.accent !== true) return err("the accentStyle needs accent: true; leave it out or set the accent");
  if (options.accent === true && layout !== "kicker-title" && layout !== "pill") {
    return err(`the accent is drawn only by the layouts "kicker-title" and "pill", not "${layout}"; leave it out`);
  }
  if (kicker !== undefined && layout !== "kicker-title") return err(`the kicker is drawn only by the layout "kicker-title", not "${layout}"; leave it out`);
  if (layout === "photo") return caption === undefined ? ok(null) : err('the layout "photo" draws no text; leave the caption out or pick a text layout');
  if (caption === undefined) return err(`the layout "${layout}" needs a caption`);
  if (layout === "kicker-title") return kicker === undefined ? err('the layout "kicker-title" needs a kicker') : ok({ layout, caption, kicker });
  if (layout === "pill" && caption.length > MAX_COVER_PILL_LENGTH) {
    return err(`the pill label ${JSON.stringify(caption)} is longer than ${String(MAX_COVER_PILL_LENGTH)} characters`);
  }
  return ok({ layout, caption });
}

function describeCover(id: string | undefined): string {
  return id === undefined ? "Photo cover" : `Photo cover "${id}"`;
}

function readPhoto(photo: string | Buffer): OgResult<Buffer> {
  if (typeof photo !== "string") return ok(photo);
  try {
    return ok(readFileSync(photo));
  } catch (error) {
    return err(`reading the photo ${photo}: ${(error as NodeJS.ErrnoException).code ?? String(error)}`);
  }
}

/** A contrast ratio as errors write it, rounded down so a ratio just under the bound never reads as the bound. */
const describeContrast = (ratio: number) => `${(Math.floor(ratio * 100) / 100).toFixed(2)}:1`;

/** The colours a cover's text is drawn in. */
interface CoverInk {
  /** The caption (and the kicker without the accent). */
  text: string;
  /** The scrim and the shadow. */
  shade: string;
  kicker: string;
  /** The box behind the kicker (a boxed accent); null for none. */
  kickerBox: string | null;
  pill: { box: string; alpha: number; text: string };
  /** How the accent was drawn and the contrast it reads at; null without the accent. */
  accent: { style: "text" | "box"; contrast: number } | null;
}

/**
 * The cover's colours: the text the brand's light colour and the scrim the dark one, swapped for a `dark` tone; with
 * the accent, the kicker or the pill box in `colors.accent`. An error when the accent reads under 3:1.
 */
function getCoverInk(colors: BrandColors, options: { tone: PhotoCoverTone; layout: CoverText["layout"] | null; accent: boolean; accentStyle: PhotoCoverAccentStyle }): OgResult<CoverInk> {
  const foreground = toOpaqueHex(colors.foreground);
  const background = toOpaqueHex(colors.background);
  const [light, dark] = getRelativeLuminance(foreground) >= getRelativeLuminance(background) ? [foreground, background] : [background, foreground];
  const [text, shade] = options.tone === "light" ? [light, dark] : [dark, light];
  const plain: CoverInk = { text, shade, kicker: text, kickerBox: null, pill: { box: shade, alpha: PILL_ALPHA, text }, accent: null };
  if (!options.accent) return ok(plain);
  const accent = toOpaqueHex(colors.accent);
  // The better-reading of the light and dark colour on the accent, for text set on an accent box.
  const label = getContrastRatio(accent, light) >= getContrastRatio(accent, dark) ? light : dark;
  const boxRatio = getContrastRatio(accent, label);
  if (options.layout === "kicker-title") {
    const ratio = getContrastRatio(accent, shade);
    const style = options.accentStyle === "auto" ? (ratio >= MIN_COVER_ACCENT_CONTRAST ? "text" : "box") : options.accentStyle;
    if (style === "text") {
      if (ratio < MIN_COVER_ACCENT_CONTRAST) {
        return err(
          `the accent ${accent} has a contrast of ${describeContrast(ratio)} against the scrim ${shade}, under 3:1; pick a ${getRelativeLuminance(accent) < getRelativeLuminance(shade) ? "darker" : "lighter"} accent, the other tone or accentStyle "box"`,
        );
      }
      return ok({ ...plain, kicker: accent, accent: { style: "text", contrast: ratio } });
    }
    if (boxRatio < MIN_COVER_ACCENT_CONTRAST) {
      return err(`the accent ${accent} as a box has a contrast of ${describeContrast(boxRatio)} against the kicker ${label}, under 3:1; pick an accent that reads with the foreground or the background`);
    }
    return ok({ ...plain, kicker: label, kickerBox: accent, accent: { style: "box", contrast: boxRatio } });
  }
  if (options.layout === "pill") {
    if (boxRatio < MIN_COVER_ACCENT_CONTRAST) {
      return err(`the accent ${accent} has a contrast of ${describeContrast(boxRatio)} against the pill label ${label}, under 3:1; pick an accent that reads with the foreground or the background`);
    }
    // Opaque, so the contrast checked is the contrast drawn whatever the photo under it.
    return ok({ ...plain, pill: { box: accent, alpha: 0xff, text: label }, accent: { style: "box", contrast: boxRatio } });
  }
  return ok(plain);
}

interface TextLayout {
  size: readonly [number, number];
  band: CoverBand;
  text: CoverText;
  fonts: OgFonts;
  ink: CoverInk;
}

/** Where the text block sits: its foot above the band's lower edge, its head below the band's top, or centred in the middle third. */
function getBlockPlacement(layout: TextLayout, scale: number): Record<string, number | string> {
  const [, height] = layout.size;
  const { band } = layout;
  const region = LAYOUT_REGIONS[layout.text.layout];
  if (region === "lower half") return { bottom: height - (band.top + band.height) + Math.round(CAPTION_BOTTOM_PADDING * scale) };
  if (region === "upper half") return { top: band.top + Math.round(CAPTION_TOP_PADDING * scale) };
  const rows = getRegionRows(band, region);
  return { top: rows.top, height: rows.bottom - rows.top, justifyContent: "center" };
}

/** The text alone on a transparent frame, laid out by its layout and centred across the band. */
function buildTextTree(layout: TextLayout): OgNode {
  const [width, height] = layout.size;
  const { band, fonts, ink, text } = layout;
  const scale = band.width / BAND_BASE_WIDTH;
  const side = Math.round(CAPTION_SIDE_PADDING * scale);
  const font = { fontFamily: toFontFamilyCss(fonts.heading), fontWeight: pickWeight(fonts.heading.weights, 700) };
  const shadow = `0px ${String(Math.round(4 * scale))}px ${String(Math.round(24 * scale))}px ${withAlpha(ink.shade, 0xb3)}`;
  const line = (content: string, style: Record<string, number | string>) =>
    h("div", { style: { display: "flex", justifyContent: "center", width: "100%", textAlign: "center", wordBreak: "break-word", color: ink.text, ...font, ...style } }, content);
  const children =
    text.layout === "pill"
      ? [
          h(
            "div",
            {
              style: {
                display: "flex",
                maxWidth: "100%",
                padding: `${String(Math.round(PILL_PADDING[0] * scale))}px ${String(Math.round(PILL_PADDING[1] * scale))}px`,
                borderRadius: Math.round(PILL_SIZE * scale),
                backgroundColor: withAlpha(ink.pill.box, ink.pill.alpha),
                textAlign: "center",
                wordBreak: "break-word",
                color: ink.pill.text,
                fontSize: Math.round(PILL_SIZE * scale),
                lineHeight: 1.15,
                ...font,
              },
            },
            text.caption,
          ),
        ]
      : [
          ...(text.layout === "kicker-title"
            ? [
                ink.kickerBox === null
                  ? line(text.kicker, { color: ink.kicker, fontSize: Math.round(KICKER_SIZE * scale), lineHeight: 1.2, letterSpacing: Math.round(3 * scale), marginBottom: Math.round(KICKER_GAP * scale), textShadow: shadow })
                  : h(
                      "div",
                      {
                        style: {
                          display: "flex",
                          maxWidth: "100%",
                          padding: `${String(Math.round(KICKER_BOX_PADDING[0] * scale))}px ${String(Math.round(KICKER_BOX_PADDING[1] * scale))}px`,
                          borderRadius: Math.round(KICKER_BOX_RADIUS * scale),
                          backgroundColor: ink.kickerBox,
                          textAlign: "center",
                          wordBreak: "break-word",
                          color: ink.kicker,
                          fontSize: Math.round(KICKER_SIZE * scale),
                          lineHeight: 1.2,
                          letterSpacing: Math.round(3 * scale),
                          marginBottom: Math.round(KICKER_GAP * scale),
                          ...font,
                        },
                      },
                      text.kicker,
                    ),
              ]
            : []),
          line(text.caption, { fontSize: Math.round(getCoverCaptionSize(text.caption) * scale), lineHeight: 1.08, textShadow: shadow }),
        ];
  return h(
    "div",
    { style: { display: "flex", position: "relative", width, height } },
    h(
      "div",
      {
        style: {
          position: "absolute",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          left: band.left + side,
          width: band.width - 2 * side,
          ...getBlockPlacement(layout, scale),
        },
      },
      ...children,
    ),
  );
}

/** How errors name the cover's text, e.g. `the kicker "New" and the caption "Lisbon"`. */
function describeText(text: CoverText): { name: string; isPlural: boolean } {
  if (text.layout === "pill") return { name: `the pill label ${JSON.stringify(text.caption)}`, isPlural: false };
  if (text.layout === "kicker-title") return { name: `the kicker ${JSON.stringify(text.kicker)} and the caption ${JSON.stringify(text.caption)}`, isPlural: true };
  return { name: `the caption ${JSON.stringify(text.caption)}`, isPlural: false };
}

function checkTextGlyphs(tree: OgNode, fonts: OgFonts, text: CoverText): OgResult<null> {
  const missing = findMissingGlyphs(tree, fonts.satoriFonts);
  if (!missing.ok) return err(`reading ${missing.error}`);
  const sentences = missing.value
    .filter((entry) => entry.characters.length > 0)
    .map((entry) => {
      const role = text.layout === "pill" ? "pill label" : text.layout === "kicker-title" && entry.text === text.kicker ? "kicker" : "caption";
      return `the ${role} ${JSON.stringify(entry.text)} has characters none of the loaded fonts can draw at its weight: ${entry.characters.map(describeCharacter).join(", ")}`;
    });
  if (sentences.length === 0) return ok(null);
  return err(`${sentences.join("; ")}. Use font files that cover them`);
}

/** The box of `pixels` (RGBA, `width` wide) that holds anything drawn (`right` and `bottom` excluded), or null when nothing is. */
function findDrawnBox(pixels: Uint8Array, width: number, height: number): CoverBox | null {
  let top = height;
  let bottom = -1;
  let left = width;
  let right = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if ((pixels[(y * width + x) * 4 + 3] ?? 0) <= DRAWN_ALPHA) continue;
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
      left = Math.min(left, x);
      right = Math.max(right, x);
    }
  }
  return bottom < 0 ? null : { left, top, right: right + 1, bottom: bottom + 1 };
}

/** The text as SVG and the box it draws, or an error when it does not fit its part of the band. */
async function layOutText(layout: TextLayout): Promise<OgResult<{ svg: string; box: CoverBox }>> {
  const tree = buildTextTree(layout);
  const glyphs = checkTextGlyphs(tree, layout.fonts, layout.text);
  if (!glyphs.ok) return glyphs;
  const [width, height] = layout.size;
  let svg: string;
  try {
    // Satori is typed for React elements; it reads only `type` and `props`, which `OgNode` has.
    svg = await satori(tree as unknown as Parameters<typeof satori>[0], { width, height, fonts: layout.fonts.satoriFonts });
  } catch (error) {
    return err(`laying out the text failed: ${error instanceof Error ? error.message : String(error)}`);
  }
  const pixels = new Resvg(svg, { fitTo: { mode: "original" }, font: { loadSystemFonts: false } }).render().pixels;
  const box = findDrawnBox(pixels, width, height);
  const { name, isPlural } = describeText(layout.text);
  if (box === null) return err(`${name} ${isPlural ? "draw" : "draws"} nothing`);
  const { band } = layout;
  // The text keeps to the part of the band its layout names, so the photo's subject elsewhere stays clear.
  const region = LAYOUT_REGIONS[layout.text.layout];
  const rows = getRegionRows(band, region);
  const isInside = box.top >= rows.top && box.bottom <= rows.bottom && box.left >= band.left && box.right <= band.left + band.width;
  if (!isInside) {
    return err(`${name} ${isPlural ? "do" : "does"} not fit the ${region} of the centre 4:5 band (${String(band.width)}×${String(band.height)}); shorten ${isPlural ? "them" : "it"}`);
  }
  return ok({ svg, box });
}

/**
 * The scrim behind the text, as SVG: a gradient of the shade that follows the text's position; none for a pill (its
 * box is its scrim). `text.top` is the text's first drawn row and `text.bottom` its last.
 */
function buildScrim(input: { size: readonly [number, number]; band: CoverBand; layout: CoverText["layout"]; text: { top: number; bottom: number }; shade: string }): string {
  const [width, height] = input.size;
  const { band, shade } = input;
  const region = LAYOUT_REGIONS[input.layout];
  if (input.layout === "pill") return "";
  const fade = Math.round(band.height / 5);
  const alpha = (SCRIM_ALPHA / 255).toFixed(3);
  const stop = (offset: number, opacity: string) => `<stop offset="${offset.toFixed(4)}" stop-color="${shade}" stop-opacity="${opacity}"/>`;
  const gradient = (y1: number, y2: number, stops: string) =>
    `<defs><linearGradient id="scrim" gradientUnits="userSpaceOnUse" x1="0" y1="${String(y1)}" x2="0" y2="${String(y2)}">${stops}</linearGradient></defs>`;
  const rect = (top: number, bottom: number) => `<rect y="${String(top)}" width="${String(width)}" height="${String(bottom - top)}" fill="url(#scrim)"/>`;
  if (region === "lower half") {
    // Fades in over a fifth of the band above the text and holds from the band's lower edge down.
    const start = Math.max(0, input.text.top - fade);
    return gradient(start, band.top + band.height, stop(0, "0") + stop(1, alpha)) + rect(start, height);
  }
  if (region === "upper half") {
    // Holds from the frame's top to the band's top and fades out over a fifth of the band below the text.
    const end = Math.min(height, input.text.bottom + fade);
    return gradient(band.top, end, stop(0, alpha) + stop(1, "0")) + rect(0, end);
  }
  // Fades in above the text, holds behind it and fades out below it.
  const start = Math.max(0, input.text.top - fade);
  const end = Math.min(height, input.text.bottom + fade);
  const span = Math.max(1, end - start);
  return gradient(start, end, stop(0, "0") + stop((input.text.top - start) / span, alpha) + stop((input.text.bottom - start) / span, alpha) + stop(1, "0")) + rect(start, end);
}

const toDataUri = (type: string, bytes: Buffer | string) => `data:${type};base64,${Buffer.from(bytes).toString("base64")}`;

/** Renders the cover: the photo cropped to `size` around the focus point, the layout's text (if any) over a soft scrim. */
export async function renderPhotoCover(input: PhotoCoverInput): Promise<OgResult<PhotoCover>> {
  const name = describeCover(input.id);
  const parsed = coverOptionsSchema.safeParse({
    photo: input.photo,
    size: input.size,
    focus: input.focus,
    layout: input.layout,
    caption: input.caption,
    kicker: input.kicker,
    tone: input.tone,
    accent: input.accent,
    accentStyle: input.accentStyle,
    quality: input.quality,
  });
  if (!parsed.success) {
    const lines = parsed.error.issues.map((issue) => `  ${issue.path.length > 0 ? issue.path.join(".") : "input"}: ${issue.message}`);
    return err(`${name}: the input is not valid:\n${lines.join("\n")}`);
  }
  const options = parsed.data;
  const text = resolveCoverText(options);
  if (!text.ok) return err(`${name}: ${text.error}.`);
  const bytes = readPhoto(options.photo);
  if (!bytes.ok) return err(`${name}: ${bytes.error}.`);
  const info = readPhotoInfo(bytes.value);
  if (!info.ok) return err(`${name}: the photo${typeof options.photo === "string" ? ` ${options.photo}` : ""} cannot be used: ${info.error}.`);

  const size = options.size;
  const [width, height] = size;
  const band = getCoverBand(size);
  const ink = getCoverInk(input.colors, { tone: options.tone ?? "light", layout: text.value?.layout ?? null, accent: options.accent ?? false, accentStyle: options.accentStyle ?? "text" });
  if (!ink.ok) return err(`${name}: ${ink.error}.`);
  const drawn = text.value === null ? null : await layOutText({ size, band, text: text.value, fonts: input.fonts, ink: ink.value });
  if (drawn !== null && !drawn.ok) return err(`${name}: ${drawn.error}.`);

  const oriented = getOrientedSize(info.value);
  const crop = getCoverCrop(oriented, size, options.focus);
  const focusPoint = { x: crop.x + options.focus.x * oriented.width * crop.scale, y: crop.y + options.focus.y * oriented.height * crop.scale };
  const matrix = getOrientationMatrix(info.value.orientation, info.value.width, info.value.height).join(" ");
  const layers = [
    `<rect width="${String(width)}" height="${String(height)}" fill="${ink.value.shade}"/>`,
    `<image href="${toDataUri(`image/${info.value.format}`, bytes.value)}" width="${String(info.value.width)}" height="${String(info.value.height)}" preserveAspectRatio="none" ` +
      `transform="translate(${String(crop.x)} ${String(crop.y)}) scale(${String(crop.scale)}) matrix(${matrix})"/>`,
  ];
  if (drawn !== null && text.value !== null) {
    layers.push(
      buildScrim({ size, band, layout: text.value.layout, text: { top: drawn.value.box.top, bottom: drawn.value.box.bottom - 1 }, shade: ink.value.shade }),
      `<image href="${toDataUri("image/svg+xml", drawn.value.svg)}" width="${String(width)}" height="${String(height)}"/>`,
    );
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${String(width)}" height="${String(height)}" viewBox="0 0 ${String(width)} ${String(height)}">${layers.join("")}</svg>`;
  try {
    const image = new Resvg(svg, { fitTo: { mode: "original" }, font: { loadSystemFonts: false } }).render();
    const encoded = jpeg.encode({ data: Buffer.from(image.pixels), width: image.width, height: image.height }, options.quality).data;
    return ok({ jpeg: encoded, width: image.width, height: image.height, bytes: encoded.length, textBox: drawn === null ? null : { ...drawn.value.box }, focusPoint, accent: ink.value.accent });
  } catch (error) {
    return err(`${name}: drawing the cover failed: ${error instanceof Error ? error.message : String(error)}.`);
  }
}

/**
 * Whether `point` lies under the cover's text: inside its `textBox` grown by `marginPx` on every side (0 by default).
 * A cover without text (layout `photo`) covers no point. Use it with `focusPoint` to warn when the text hides the
 * photo's subject.
 */
export function isPointUnderCoverText(cover: Pick<PhotoCover, "textBox">, point: CoverPoint, marginPx = 0): boolean {
  if (!Number.isFinite(marginPx) || marginPx < 0) throw new RangeError(`isPointUnderCoverText: the margin must be a finite number of pixels, 0 or more, not ${String(marginPx)}`);
  const box = cover.textBox;
  if (box === null) return false;
  return point.x >= box.left - marginPx && point.x < box.right + marginPx && point.y >= box.top - marginPx && point.y < box.bottom + marginPx;
}
