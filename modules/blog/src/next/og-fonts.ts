// The brand's fonts for the article OG card (`blog({ brand: { fonts } })`): each source is read on the
// first card and kept for the life of the process (the loader lives in `src/server/og-fonts.ts`, which
// `softure-blog check` uses too).
import type { OgFontSource } from "../options.js";
import { createOgFontLoader, type OgFontsResult } from "../server/og-fonts.js";

export { createOgFontLoader, type OgFontLoaderOptions, type OgFontsResult } from "../server/og-fonts.js";

const loadFromApp = createOgFontLoader({ root: process.cwd() });

/** The brand's fonts for the card, read from the app's root (where Next runs) and cached. */
export function loadBrandOgFonts(fonts: readonly OgFontSource[]): Promise<OgFontsResult> {
  return loadFromApp(fonts);
}
