import { readFileSync } from "node:fs";

import { Resvg } from "@resvg/resvg-js";
import jpeg from "jpeg-js";
import satori from "satori";
import { z } from "zod";

import type { BrandColors } from "../config/colors.js";
import { h, type OgNode } from "./element.js";
import { pickWeight, toFontFamilyCss, type OgFonts } from "./fonts.js";
import { describeCharacter, findMissingGlyphs } from "./glyphs.js";
import { toOpaqueHex, withAlpha } from "./palette.js";
import { getCoverCrop, getOrientationMatrix, getOrientedSize, readPhotoInfo, type FocusPoint } from "./photo.js";
import { err, ok, type OgResult } from "./result.js";

/**
 * A publish-ready cover for a vertical video from a photo the owner picks: the photo scaled to cover the frame and
 * cropped around a focus point (EXIF orientation applied), and an optional short caption in the brand's display
 * font, kept inside the lower half of the centre 4:5 band the platforms keep when they crop the cover for the profile
 * grid. Satori
 * lays the caption out, resvg draws the whole cover, `jpeg-js` encodes it: no network, no system fonts.
 */

/** A Reels, Shorts and TikTok cover. */
export const PHOTO_COVER_SIZE: readonly [number, number] = [1080, 1920];

export const PHOTO_COVER_QUALITY = 90;

/** The longest caption accepted before layout; whether a shorter one fits is measured on the drawn caption. */
export const MAX_COVER_CAPTION_LENGTH = 80;

/** Sizes in this file are written for a 1080 px wide band and scaled with its width. */
const BAND_BASE_WIDTH = 1080;
const CAPTION_SIDE_PADDING = 80;
const CAPTION_BOTTOM_PADDING = 120;
/** A pixel whose alpha is above this counts as drawn when the caption is measured (the shadow's faint fringe does not). */
const DRAWN_ALPHA = 16;
/** The scrim's opacity at the band's lower edge and below it. */
const SCRIM_ALPHA = 0x8c;

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
  caption: z
    .string()
    .trim()
    .min(1, "the caption is empty; leave it out for a cover without one")
    .max(MAX_COVER_CAPTION_LENGTH, `the caption is longer than ${String(MAX_COVER_CAPTION_LENGTH)} characters`)
    .optional(),
  quality: z.number().int().min(1).max(100).default(PHOTO_COVER_QUALITY),
});

export interface PhotoCoverInput {
  /** A JPEG or PNG: its path, or its bytes. */
  photo: string | Buffer;
  /** The cover's size; 1080×1920 by default. */
  size?: readonly [number, number];
  /** The point of the upright photo to keep in view, as fractions of its width and height; the centre by default. */
  focus?: FocusPoint;
  /** A short title (2 to 6 words fit best); none draws the cropped photo alone. */
  caption?: string;
  /** The text is the lighter of `foreground` and `background`; the scrim and the shadow the darker. */
  colors: BrandColors;
  /** The brand's fonts (`loadOgFonts`); the caption is set in the heading (display) family. */
  fonts: OgFonts;
  /** JPEG quality, 1-100; 90 by default. */
  quality?: number;
  /** Names the cover in errors, e.g. the video's id. */
  id?: string;
}

export interface PhotoCover {
  /** A baseline JPEG of exactly `width` × `height`, without an ICC profile (sRGB). */
  jpeg: Buffer;
  width: number;
  height: number;
  bytes: number;
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

/** Relative luminance (WCAG) of an opaque `#rrggbb`. */
function getLuminance(color: string): number {
  const hex = toOpaqueHex(color);
  const channel = (offset: number) => {
    const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.039_28 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

/** The brand's light and dark colour among its foreground and background. */
function getCoverInk(colors: BrandColors): { text: string; shade: string } {
  const foreground = toOpaqueHex(colors.foreground);
  const background = toOpaqueHex(colors.background);
  return getLuminance(foreground) >= getLuminance(background) ? { text: foreground, shade: background } : { text: background, shade: foreground };
}

interface CaptionLayout {
  size: readonly [number, number];
  band: CoverBand;
  caption: string;
  fonts: OgFonts;
  ink: { text: string; shade: string };
}

/** The caption alone on a transparent frame: centred, its foot above the band's lower edge. */
function buildCaptionTree(layout: CaptionLayout): OgNode {
  const [width, height] = layout.size;
  const { band, fonts, ink } = layout;
  const scale = band.width / BAND_BASE_WIDTH;
  const side = Math.round(CAPTION_SIDE_PADDING * scale);
  const fontSize = Math.round(getCoverCaptionSize(layout.caption) * scale);
  return h(
    "div",
    { style: { display: "flex", position: "relative", width, height } },
    h(
      "div",
      {
        style: {
          position: "absolute",
          display: "flex",
          justifyContent: "center",
          left: band.left + side,
          width: band.width - 2 * side,
          bottom: height - (band.top + band.height) + Math.round(CAPTION_BOTTOM_PADDING * scale),
          fontFamily: toFontFamilyCss(fonts.heading),
          fontSize,
          fontWeight: pickWeight(fonts.heading.weights, 700),
          lineHeight: 1.08,
          textAlign: "center",
          wordBreak: "break-word",
          color: ink.text,
          textShadow: `0px ${String(Math.round(4 * scale))}px ${String(Math.round(24 * scale))}px ${withAlpha(ink.shade, 0xb3)}`,
        },
      },
      layout.caption,
    ),
  );
}

function checkCaptionGlyphs(tree: OgNode, fonts: OgFonts, caption: string): OgResult<null> {
  const missing = findMissingGlyphs(tree, fonts.satoriFonts);
  if (!missing.ok) return err(`reading ${missing.error}`);
  const characters = missing.value.flatMap((entry) => entry.characters);
  if (characters.length === 0) return ok(null);
  return err(
    `the caption ${JSON.stringify(caption)} has characters none of the loaded fonts can draw at its weight: ${characters.map(describeCharacter).join(", ")}. ` +
      "Use font files that cover them.",
  );
}

/** The rows of `pixels` (RGBA, `width` wide) that hold anything drawn, or null when nothing is. */
function findDrawnBox(pixels: Uint8Array, width: number, height: number): { top: number; bottom: number; left: number; right: number } | null {
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
  return bottom < 0 ? null : { top, bottom, left, right };
}

/** The caption as SVG and the top of what it draws, or an error when it does not fit the band. */
async function layOutCaption(layout: CaptionLayout): Promise<OgResult<{ svg: string; top: number }>> {
  const tree = buildCaptionTree(layout);
  const glyphs = checkCaptionGlyphs(tree, layout.fonts, layout.caption);
  if (!glyphs.ok) return glyphs;
  const [width, height] = layout.size;
  let svg: string;
  try {
    // Satori is typed for React elements; it reads only `type` and `props`, which `OgNode` has.
    svg = await satori(tree as unknown as Parameters<typeof satori>[0], { width, height, fonts: layout.fonts.satoriFonts });
  } catch (error) {
    return err(`laying out the caption failed: ${error instanceof Error ? error.message : String(error)}`);
  }
  const pixels = new Resvg(svg, { fitTo: { mode: "original" }, font: { loadSystemFonts: false } }).render().pixels;
  const box = findDrawnBox(pixels, width, height);
  if (box === null) return err(`the caption ${JSON.stringify(layout.caption)} draws nothing`);
  const { band } = layout;
  // The caption keeps to the lower half of the band, so the photo's subject above it stays clear.
  const isInside = box.top >= band.top + Math.floor(band.height / 2) && box.bottom < band.top + band.height && box.left >= band.left && box.right < band.left + band.width;
  if (!isInside) {
    return err(`the caption ${JSON.stringify(layout.caption)} does not fit the lower half of the centre 4:5 band (${String(band.width)}×${String(band.height)}); shorten it`);
  }
  return ok({ svg, top: box.top });
}

const toDataUri = (type: string, bytes: Buffer | string) => `data:${type};base64,${Buffer.from(bytes).toString("base64")}`;

/** Renders the cover: the photo cropped to `size` around the focus point, the caption (if any) over a soft scrim. */
export async function renderPhotoCover(input: PhotoCoverInput): Promise<OgResult<PhotoCover>> {
  const name = describeCover(input.id);
  const parsed = coverOptionsSchema.safeParse({ photo: input.photo, size: input.size, focus: input.focus, caption: input.caption, quality: input.quality });
  if (!parsed.success) {
    const lines = parsed.error.issues.map((issue) => `  ${issue.path.length > 0 ? issue.path.join(".") : "input"}: ${issue.message}`);
    return err(`${name}: the input is not valid:\n${lines.join("\n")}`);
  }
  const options = parsed.data;
  const bytes = readPhoto(options.photo);
  if (!bytes.ok) return err(`${name}: ${bytes.error}.`);
  const info = readPhotoInfo(bytes.value);
  if (!info.ok) return err(`${name}: the photo${typeof options.photo === "string" ? ` ${options.photo}` : ""} cannot be used: ${info.error}.`);

  const size = options.size;
  const [width, height] = size;
  const band = getCoverBand(size);
  const ink = getCoverInk(input.colors);
  const caption = options.caption === undefined ? null : await layOutCaption({ size, band, caption: options.caption, fonts: input.fonts, ink });
  if (caption !== null && !caption.ok) return err(`${name}: ${caption.error}.`);

  const crop = getCoverCrop(getOrientedSize(info.value), size, options.focus);
  const matrix = getOrientationMatrix(info.value.orientation, info.value.width, info.value.height).join(" ");
  const layers = [
    `<rect width="${String(width)}" height="${String(height)}" fill="${ink.shade}"/>`,
    `<image href="${toDataUri(`image/${info.value.format}`, bytes.value)}" width="${String(info.value.width)}" height="${String(info.value.height)}" preserveAspectRatio="none" ` +
      `transform="translate(${String(crop.x)} ${String(crop.y)}) scale(${String(crop.scale)}) matrix(${matrix})"/>`,
  ];
  if (caption !== null) {
    // The scrim fades in over a fifth of the band above the caption and holds from the band's lower edge down.
    const bandBottom = band.top + band.height;
    const start = Math.max(0, caption.value.top - Math.round(band.height / 5));
    layers.push(
      `<defs><linearGradient id="scrim" gradientUnits="userSpaceOnUse" x1="0" y1="${String(start)}" x2="0" y2="${String(bandBottom)}">` +
        `<stop offset="0" stop-color="${ink.shade}" stop-opacity="0"/><stop offset="1" stop-color="${ink.shade}" stop-opacity="${(SCRIM_ALPHA / 255).toFixed(3)}"/></linearGradient></defs>`,
      `<rect y="${String(start)}" width="${String(width)}" height="${String(height - start)}" fill="url(#scrim)"/>`,
      `<image href="${toDataUri("image/svg+xml", caption.value.svg)}" width="${String(width)}" height="${String(height)}"/>`,
    );
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${String(width)}" height="${String(height)}" viewBox="0 0 ${String(width)} ${String(height)}">${layers.join("")}</svg>`;
  try {
    const image = new Resvg(svg, { fitTo: { mode: "original" }, font: { loadSystemFonts: false } }).render();
    const encoded = jpeg.encode({ data: Buffer.from(image.pixels), width: image.width, height: image.height }, options.quality).data;
    return ok({ jpeg: encoded, width: image.width, height: image.height, bytes: encoded.length });
  } catch (error) {
    return err(`${name}: drawing the cover failed: ${error instanceof Error ? error.message : String(error)}.`);
  }
}
