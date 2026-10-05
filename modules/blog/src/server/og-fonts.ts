// The loader of the brand's fonts for the article OG card (`blog({ brand: { fonts } })`): each source
// is read once, checked to be a font Satori draws (.ttf, .otf, .woff; not .woff2), and kept for the
// life of the loader. A failed read is not kept, so a fixed file is picked up by the next call. It
// imports no Next code: the card's route (`@softure-ai/blog/next`) and `softure-blog check` share it.
import { readFile } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import type { OgFontSource, OgFontWeight } from "../options.js";

/** A font for the card, as `ImageResponse` takes it. */
export interface OgFont {
  readonly name: string;
  readonly data: ArrayBuffer;
  readonly weight?: OgFontWeight;
  readonly style?: "normal" | "italic";
}

export type OgFontsResult = { readonly ok: true; readonly fonts: readonly OgFont[] } | { readonly ok: false; readonly error: string };

type BytesResult = { readonly ok: true; readonly data: ArrayBuffer } | { readonly ok: false; readonly reason: string };

export interface OgFontLoaderOptions {
  /** Where a relative path starts: the app's root. */
  readonly root: string;
  readonly readFile?: (path: string) => Promise<Uint8Array>;
  readonly fetchImpl?: typeof fetch;
}

/** The first four bytes of each font format Satori parses. */
const FONT_SIGNATURES = ["wOFF", "OTTO", "\u0000\u0001\u0000\u0000", "true"];
const WOFF2_SIGNATURE = "wOF2";

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function checkFontBytes(bytes: Uint8Array): BytesResult {
  const signature = String.fromCharCode(...bytes.subarray(0, 4));
  if (signature === WOFF2_SIGNATURE) return { ok: false, reason: "a .woff2 font, which the card cannot read; use the .woff or .ttf file" };
  if (!FONT_SIGNATURES.includes(signature)) return { ok: false, reason: "not a .ttf, .otf or .woff font" };
  return { ok: true, data: toArrayBuffer(bytes) };
}

function getErrorCode(error: unknown): string {
  if (typeof error === "object" && error !== null && "code" in error && typeof error.code === "string") return error.code;
  return error instanceof Error ? error.message : String(error);
}

/** A loader with its own cache, keyed by the resolved path or URL. */
export function createOgFontLoader(options: OgFontLoaderOptions): (fonts: readonly OgFontSource[]) => Promise<OgFontsResult> {
  const read = options.readFile ?? readFile;
  const fetchImpl = options.fetchImpl ?? fetch;
  const cache = new Map<string, Promise<BytesResult>>();

  async function readSource(location: string, isUrl: boolean): Promise<BytesResult> {
    if (!isUrl) {
      try {
        return checkFontBytes(await read(location));
      } catch (error) {
        return { ok: false, reason: `the file cannot be read (${getErrorCode(error)})` };
      }
    }
    let response: Response;
    try {
      response = await fetchImpl(location);
    } catch (error) {
      return { ok: false, reason: `the request failed (${getErrorCode(error)})` };
    }
    if (!response.ok) return { ok: false, reason: `the server answered ${response.status}` };
    try {
      return checkFontBytes(new Uint8Array(await response.arrayBuffer()));
    } catch (error) {
      return { ok: false, reason: `the answer could not be read (${getErrorCode(error)})` };
    }
  }

  function getBytes(location: string, isUrl: boolean): Promise<BytesResult> {
    const cached = cache.get(location);
    if (cached !== undefined) return cached;
    const pending = readSource(location, isUrl).then((result) => {
      if (!result.ok) cache.delete(location);
      return result;
    });
    cache.set(location, pending);
    return pending;
  }

  return async (fonts) => {
    const located = fonts.map((font) => {
      const isUrl = font.src.startsWith("https://");
      return { font, isUrl, location: isUrl || isAbsolute(font.src) ? font.src : resolve(options.root, font.src) };
    });
    const results = await Promise.all(located.map(async (entry) => ({ ...entry, result: await getBytes(entry.location, entry.isUrl) })));
    const loaded: OgFont[] = [];
    for (const [index, { font, location, result }] of results.entries()) {
      if (!result.ok) return { ok: false, error: `Blog OG card: brand.fonts[${index}] "${font.src}": ${result.reason} (${location}).` };
      loaded.push({ name: font.name, data: result.data, weight: font.weight, style: font.style });
    }
    return { ok: true, fonts: loaded };
  };
}
