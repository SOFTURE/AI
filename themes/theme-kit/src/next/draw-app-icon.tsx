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

/** The pair of contract colour roles an icon is drawn in: its background, then its glyph. */
const TONE_ROLES = {
  primary: ["primary", "primary-foreground"],
  secondary: ["secondary", "secondary-foreground"],
  accent: ["accent", "accent-foreground"],
  inverse: ["foreground", "background"],
} as const;

export type AppIconTone = keyof typeof TONE_ROLES;

/** `rounded` for a tab icon; `square` (full bleed) for the apple icon, which iOS masks itself. */
export type AppIconShape = "rounded" | "square";

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
}

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const NAME_PATTERN = /^[A-Za-z][\w:.-]*$/;
const CORNER_RATIO = 0.22;
const GLYPH_RATIO = 0.625;

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

/** The glyph as standalone SVG markup drawn in `color`: `currentColor` reads the root's `color`. */
export function renderIconSvg(icon: AppIconGlyph, color: string): string {
  const colorAttribute = `color="${escapeAttribute(color)}" xmlns="${SVG_NAMESPACE}"`;
  if (!isSvgMarkup(icon)) {
    const stroke = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
    return `<svg ${colorAttribute} viewBox="0 0 24 24" ${stroke}>${icon.map(renderIconElement).join("")}</svg>`;
  }
  const markup = icon.svg.trim();
  if (!markup.startsWith("<svg") || !markup.endsWith("</svg>")) {
    throw new Error(`renderIconSvg: the icon's svg must be one <svg> element, got ${markup.slice(0, 60)}`);
  }
  return `<svg ${colorAttribute}${markup.slice("<svg".length).replace(` xmlns="${SVG_NAMESPACE}"`, "")}`;
}

/** The element `next/og` draws: the tone's background, the glyph centred in the tone's foreground. */
export function buildAppIconElement({
  theme,
  icon,
  size = APP_ICON_SIZE,
  tone = "primary",
  scheme = "light",
  shape = "rounded",
}: AppIconOptions): ReactElement {
  const [backgroundRole, glyphRole] = TONE_ROLES[tone];
  const side = Math.min(size.width, size.height);
  const glyphSide = Math.round(side * GLYPH_RATIO);
  const svg = renderIconSvg(icon, getThemeColor(theme, glyphRole, scheme));
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

/** The default export of `app/icon.tsx` or `app/apple-icon.tsx`: the icon as a PNG of `size`. */
export function drawAppIcon(options: AppIconOptions): ImageResponse {
  return new ImageResponse(buildAppIconElement(options), options.size ?? APP_ICON_SIZE);
}
