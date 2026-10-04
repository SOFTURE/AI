import { readFileSync } from "node:fs";

import { Resvg } from "@resvg/resvg-js";
import satori from "satori";

import type { BrandColors } from "../config/colors.js";
import type { MarketingConfig } from "../config/config.js";
import { formatIssuePath } from "../config/issues.js";
import type { OgNode } from "./element.js";
import { loadOgFonts, type OgFonts, type ReadFontFile } from "./fonts.js";
import { describeCharacter, findMissingGlyphs, type MissingGlyphs } from "./glyphs.js";
import { getOgPalette } from "./palette.js";
import { err, ok, type OgResult } from "./result.js";
import { BASE_WIDTH } from "./templates/context.js";
import { OG_TEMPLATE_IDS, OG_TEMPLATES, isOgTemplateId } from "./templates/index.js";

/** Satori lays a tree out to SVG; resvg rasterises it. Neither reads the machine's fonts. */

export const DEFAULT_OG_SIZE: readonly [number, number] = [1200, 630];

/** Everything about the brand a card shows. */
export interface OgBrand {
  name: string;
  colors: BrandColors;
  /** The logo's SVG source, or null. */
  logoSvg: string | null;
}

export interface OgImageInput {
  template: string;
  /** The template's data, checked against its schema here. */
  data: unknown;
  size?: readonly [number, number];
  brand: OgBrand;
  fonts: OgFonts;
  /** Names the card in errors, e.g. its `ogImages` id. */
  id?: string;
  /** Where `data` sits in the caller's JSON, for error paths; `["data"]` by default. */
  dataPath?: readonly PropertyKey[];
}

/** At most this many characters are listed per text; the rest is counted. */
const MAX_LISTED_CHARACTERS = 10;

function describeCard(input: OgImageInput): string {
  return input.id === undefined ? "OG image" : `OG image "${input.id}"`;
}

/** Every string in the data with its JSON path. */
function listStrings(value: unknown, path: readonly PropertyKey[]): { path: string; text: string }[] {
  if (typeof value === "string") return [{ path: formatIssuePath(path), text: value }];
  if (Array.isArray(value)) return value.flatMap((item, index) => listStrings(item, [...path, index]));
  if (typeof value === "object" && value !== null) return Object.entries(value).flatMap(([key, item]) => listStrings(item, [...path, key]));
  return [];
}

function formatMissingGlyphs(missing: readonly MissingGlyphs[], sources: readonly { path: string; text: string }[]): string[] {
  return missing.flatMap(({ text, characters }) => {
    const listed = characters.slice(0, MAX_LISTED_CHARACTERS).map(describeCharacter).join(", ");
    const more = characters.length > MAX_LISTED_CHARACTERS ? ` and ${characters.length - MAX_LISTED_CHARACTERS} more` : "";
    const paths = sources.filter((source) => source.text === text).map((source) => source.path);
    return (paths.length > 0 ? paths : [`text ${JSON.stringify(text)}`]).map((path) => `  ${path}: ${listed}${more}`);
  });
}

/** Refuses a tree with characters Satori would leave out; `strings` name each text by its JSON path. */
function checkGlyphs(input: OgImageInput, tree: OgNode, strings: readonly { path: string; text: string }[]): OgResult<null> {
  const missing = findMissingGlyphs(tree, input.fonts.satoriFonts);
  if (!missing.ok) return err(`${describeCard(input)}: reading ${missing.error}.`);
  if (missing.value.length === 0) return ok(null);
  const lines = formatMissingGlyphs(missing.value, [...strings, { path: "brand.name", text: input.brand.name }]);
  return err(
    `${describeCard(input)}: template "${input.template}" has characters none of the loaded fonts can draw at the text's weight and style:\n${lines.join("\n")}\n` +
      "Use font files that cover them at every weight the copy uses. Several files of one weight and style (subset files such as latin and latin-ext) are tried in the order listed.",
  );
}

function toDataUri(svg: string): string {
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

/**
 * The element tree of a card, after its data passed the template's schema and every character it
 * draws has a glyph in the fonts Satori would use for it.
 */
export function buildOgTree(input: OgImageInput): OgResult<OgNode> {
  if (!isOgTemplateId(input.template)) {
    return err(`${describeCard(input)}: unknown template "${input.template}"; known: ${OG_TEMPLATE_IDS.join(", ")}.`);
  }
  const dataPath = input.dataPath ?? ["data"];
  const template = OG_TEMPLATES[input.template];
  const parsed = template.schema.safeParse(input.data);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((issue) => `  ${formatIssuePath([...dataPath, ...issue.path])}: ${issue.message}`);
    return err(`${describeCard(input)}: the data of template "${input.template}" is not valid:\n${lines.join("\n")}`);
  }
  const [width, height] = input.size ?? DEFAULT_OG_SIZE;
  const tree = template.build(parsed.data, {
    width,
    height,
    scale: width / BASE_WIDTH,
    palette: getOgPalette(input.brand.colors),
    fonts: { heading: input.fonts.heading, body: input.fonts.body },
    brand: { name: input.brand.name, logo: input.brand.logoSvg === null ? null : toDataUri(input.brand.logoSvg) },
  });
  const glyphs = checkGlyphs(input, tree, listStrings(parsed.data, dataPath));
  return glyphs.ok ? ok(tree) : glyphs;
}

/** The card as SVG (Satori's output, text drawn as paths). */
export async function renderOgSvg(input: OgImageInput): Promise<OgResult<string>> {
  const tree = buildOgTree(input);
  if (!tree.ok) return tree;
  const [width, height] = input.size ?? DEFAULT_OG_SIZE;
  try {
    // Satori is typed for React elements; it reads only `type` and `props`, which `OgNode` has.
    const svg = await satori(tree.value as unknown as Parameters<typeof satori>[0], { width, height, fonts: input.fonts.satoriFonts });
    return ok(svg);
  } catch (error) {
    return err(`${describeCard(input)}: laying out template "${input.template}" failed: ${error instanceof Error ? error.message : String(error)}.`);
  }
}

/** The card as a PNG of exactly `size` pixels. */
export async function renderOgImage(input: OgImageInput): Promise<OgResult<Buffer>> {
  const svg = await renderOgSvg(input);
  if (!svg.ok) return svg;
  try {
    const png = new Resvg(svg.value, { fitTo: { mode: "original" }, font: { loadSystemFonts: false } }).render().asPng();
    return ok(png);
  } catch (error) {
    return err(`${describeCard(input)}: rasterising template "${input.template}" failed: ${error instanceof Error ? error.message : String(error)}.`);
  }
}

export interface ConfiguredOgImageOptions {
  config: MarketingConfig;
  /** The `ogImages` entry's id. */
  id: string;
  /** Replaces the entry's data, e.g. values a route computes per request; checked like the config's. */
  data?: unknown;
  /** Reads font files; by default from disk. */
  readFile?: ReadFontFile;
}

function readLogo(path: string | null, read: (path: string) => Buffer): OgResult<string | null> {
  if (path === null) return ok(null);
  try {
    return ok(read(path).toString("utf8"));
  } catch (error) {
    return err(`OG image: reading the logo ${path} (brand.logo.svg): ${(error as NodeJS.ErrnoException).code ?? String(error)}.`);
  }
}

/** Renders an `ogImages` entry of a loaded `marketing.json` with the brand's fonts, colours and logo. */
export async function renderConfiguredOgImage(options: ConfiguredOgImageOptions): Promise<OgResult<Buffer>> {
  const { config, id } = options;
  const read = options.readFile ?? readFileSync;
  const index = config.ogImages.findIndex((image) => image.id === id);
  const entry = config.ogImages[index];
  if (entry === undefined) {
    const known = config.ogImages.map((image) => image.id);
    return err(`OG image: no "${id}" in ogImages of ${config.file}${known.length > 0 ? `; known: ${known.join(", ")}` : ""}.`);
  }
  const fonts = loadOgFonts(config.brand.fonts, read);
  if (!fonts.ok) return fonts;
  const logo = readLogo(config.brand.logo, read);
  if (!logo.ok) return logo;
  return renderOgImage({
    template: entry.template,
    data: options.data ?? entry.data,
    size: entry.size,
    brand: { name: config.brand.name, colors: config.brand.colors, logoSvg: logo.value },
    fonts: fonts.value,
    id,
    dataPath: options.data === undefined ? ["ogImages", index, "data"] : ["data"],
  });
}
