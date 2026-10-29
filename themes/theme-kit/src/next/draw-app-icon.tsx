// The app's tab and home screen icon (`app/icon.tsx`, `app/apple-icon.tsx`), drawn by `next/og` in the theme's
// colours. The image is drawn outside the page, so it reads the token values, not the CSS variables.
//
// The glyph is data, not a React component: a metadata route renders on the server, where lucide-react's icons are
// client modules (`"use client"`, `useContext`) that neither React's server renderer nor `next/og` can call. lucide's
// framework-free package (`lucide`) exports the same icons as data (`IconNode`).
import { ImageResponse } from "next/og";
import type { ReactElement } from "react";

import { getThemeColor, type ColorScheme } from "../get-theme-color.js";
import type { ThemeDefinition } from "../theme-definition.js";

/** The tab icon's size, for `export const size` in `app/icon.tsx`. */
export const APP_ICON_SIZE = { width: 32, height: 32 } as const;

/** The home screen icon's size (iOS), for `export const size` in `app/apple-icon.tsx`. */
export const APPLE_ICON_SIZE = { width: 180, height: 180 } as const;

/** The web app manifest's standard icon size (`192x192`). */
export const MANIFEST_ICON_SIZE = { width: 192, height: 192 } as const;

/** The web app manifest's large icon size (`512x512`), also the size of its maskable icon. */
export const MANIFEST_LARGE_ICON_SIZE = { width: 512, height: 512 } as const;

/** The diameter of a maskable icon's safe zone, a circle centred in the icon, as a share of its side (W3C manifest). */
export const MASKABLE_SAFE_ZONE = 0.8;

/** The pair of contract colour roles an icon is drawn in: its background, then its glyph. */
const TONE_ROLES = {
  primary: ["primary", "primary-foreground"],
  secondary: ["secondary", "secondary-foreground"],
  accent: ["accent", "accent-foreground"],
  inverse: ["foreground", "background"],
} as const;

export type AppIconTone = keyof typeof TONE_ROLES;

/**
 * `rounded` for a tab icon; `square` (full bleed) for the apple icon, which iOS masks itself; `maskable` (full bleed,
 * the glyph inside the safe zone) for a manifest icon with `purpose: "maskable"`, which launchers crop.
 */
export type AppIconShape = "rounded" | "square" | "maskable";

/** One element of a 24 × 24 stroke icon: its tag, its attributes and its own children, as lucide's `IconNode` holds it. */
export type IconNodeElement = readonly [
  tag: string,
  attributes: Readonly<Record<string, string | number | undefined>>,
  children?: readonly IconNodeElement[],
];

/** A 24 × 24 stroke icon as data (`Wallet` from `lucide`), drawn with lucide's stroke defaults. */
export type IconNode = readonly IconNodeElement[];

/** The glyph: a stroke icon as data, or a standalone `<svg>` of another icon set drawn in `currentColor`. */
export type AppIconGlyph = IconNode | { readonly svg: string };

export interface AppIconOptions {
  /** Any theme that meets the contract (`theme` from `@softure-ai/theme-<name>`). */
  theme: Pick<ThemeDefinition, "name" | "colors">;
  icon: AppIconGlyph;
  /** `APP_ICON_SIZE` by default. */
  size?: { width: number; height: number };
  /** `primary` by default. */
  tone?: AppIconTone;
  /** `light` by default: a favicon is one image for both schemes. */
  scheme?: ColorScheme;
  /** `rounded` by default. */
  shape?: AppIconShape;
  /** The glyph's side as a share of the icon's shorter side: 0.625 by default, 0.5 for `maskable`. */
  glyphScale?: number;
  /** The stroke width of an `IconNode` glyph in its 24-unit grid: lucide's 2 by default. Not for `{ svg }` markup. */
  strokeWidth?: number;
}

export interface IconSvgOptions {
  /** The stroke width of an `IconNode` glyph: 2 by default. `{ svg }` markup draws its own stroke and refuses it. */
  strokeWidth?: number;
}

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const NAME_PATTERN = /^[A-Za-z][\w:.-]*$/;
const CORNER_RATIO = 0.22;
const DEFAULT_STROKE_WIDTH = 2;
const GLYPH_SCALES: Readonly<Record<AppIconShape, number>> = { rounded: 0.625, square: 0.625, maskable: 0.5 };
// The largest square glyph whose corners stay inside the safe zone circle: its half-diagonal is at most the radius.
const MASKABLE_MAX_GLYPH_SCALE = MASKABLE_SAFE_ZONE / Math.SQRT2;

function escapeAttribute(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function checkName(kind: string, name: string): string {
  if (!NAME_PATTERN.test(name)) throw new Error(`renderIconSvg: ${kind} name ${JSON.stringify(name)} is not an SVG name`);
  return name;
}

function renderIconElement([tag, attributes, children = []]: IconNodeElement): string {
  const name = checkName("tag", tag);
  const attributeText = Object.entries(attributes)
    // React's list key, which lucide-react's own icon data carries, is not an SVG attribute.
    .filter((entry): entry is [string, string | number] => entry[0] !== "key" && entry[1] !== undefined)
    .map(([attribute, value]) => ` ${checkName("attribute", attribute)}="${escapeAttribute(String(value))}"`)
    .join("");
  return `<${name}${attributeText}>${children.map(renderIconElement).join("")}</${name}>`;
}

function isSvgMarkup(icon: AppIconGlyph): icon is { readonly svg: string } {
  return "svg" in icon;
}

function checkStrokeWidth(strokeWidth: number): number {
  if (!Number.isFinite(strokeWidth) || strokeWidth <= 0) {
    throw new Error(`renderIconSvg: strokeWidth must be a positive number, got ${strokeWidth}`);
  }
  return strokeWidth;
}

/** The glyph as standalone SVG markup drawn in `color`: `currentColor` reads the root's `color`. */
export function renderIconSvg(icon: AppIconGlyph, color: string, { strokeWidth }: IconSvgOptions = {}): string {
  const colorAttribute = `color="${escapeAttribute(color)}" xmlns="${SVG_NAMESPACE}"`;
  if (!isSvgMarkup(icon)) {
    const width = checkStrokeWidth(strokeWidth ?? DEFAULT_STROKE_WIDTH);
    const stroke = `fill="none" stroke="currentColor" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"`;
    return `<svg ${colorAttribute} viewBox="0 0 24 24" ${stroke}>${icon.map(renderIconElement).join("")}</svg>`;
  }
  if (strokeWidth !== undefined) {
    throw new Error("renderIconSvg: strokeWidth applies only to icon data; the icon's svg markup draws its own stroke");
  }
  const markup = icon.svg.trim();
  if (!markup.startsWith("<svg") || !markup.endsWith("</svg>")) {
    throw new Error(`renderIconSvg: the icon's svg must be one <svg> element, got ${markup.slice(0, 60)}`);
  }
  return `<svg ${colorAttribute}${markup.slice("<svg".length).replace(` xmlns="${SVG_NAMESPACE}"`, "")}`;
}

function checkGlyphScale(shape: AppIconShape, glyphScale: number): number {
  const limit = shape === "maskable" ? MASKABLE_MAX_GLYPH_SCALE : 1;
  if (!Number.isFinite(glyphScale) || glyphScale <= 0 || glyphScale > limit) {
    const range = shape === "maskable" ? `at most ${limit.toFixed(3)} (inside the maskable safe zone)` : "at most 1";
    throw new Error(`buildAppIconElement: glyphScale must be above 0 and ${range} for the ${shape} shape, got ${glyphScale}`);
  }
  return glyphScale;
}

/** The element `next/og` draws: the tone's background, the glyph centred in the tone's foreground. */
export function buildAppIconElement({
  theme,
  icon,
  size = APP_ICON_SIZE,
  tone = "primary",
  scheme = "light",
  shape = "rounded",
  glyphScale = GLYPH_SCALES[shape],
  strokeWidth,
}: AppIconOptions): ReactElement {
  const [backgroundRole, glyphRole] = TONE_ROLES[tone];
  const side = Math.min(size.width, size.height);
  const glyphSide = Math.round(side * checkGlyphScale(shape, glyphScale));
  const svg = renderIconSvg(icon, getThemeColor(theme, glyphRole, scheme), { strokeWidth });
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        height: "100%",
        background: getThemeColor(theme, backgroundRole, scheme),
        borderRadius: shape === "rounded" ? Math.round(side * CORNER_RATIO) : 0,
      }}
    >
      <img alt="" width={glyphSide} height={glyphSide} src={`data:image/svg+xml,${encodeURIComponent(svg)}`} />
    </div>
  );
}

/** The default export of `app/icon.tsx` or `app/apple-icon.tsx`, or a manifest icon's route: the icon as a PNG of `size`. */
export function drawAppIcon(options: AppIconOptions): ImageResponse {
  return new ImageResponse(buildAppIconElement(options), options.size ?? APP_ICON_SIZE);
}
