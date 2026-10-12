// The loader of the brand's fonts for the article OG card (`blog({ brand: { fonts } })`). The loader itself lives in
// `@softure-ai/core/og` (re-exported by `@softure-ai/seo/server` for an app's other cards); the blog's copy names
// the list `Blog OG card: brand.fonts` in its messages, which the card's route and `softure-blog check` print.
import { createOgFontLoader as createCoreOgFontLoader, type OgFontLoaderOptions, type OgFontSource, type OgFontsResult } from "@softure-ai/core/og";

export type { OgFont, OgFontLoaderOptions, OgFontsResult } from "@softure-ai/core/og";

const BLOG_LABEL = "Blog OG card: brand.fonts";

/** A loader with its own cache, keyed by the resolved path or URL; messages name `brand.fonts` unless `label` says otherwise. */
export function createOgFontLoader(options: OgFontLoaderOptions): (fonts: readonly OgFontSource[]) => Promise<OgFontsResult> {
  return createCoreOgFontLoader({ ...options, label: options.label ?? BLOG_LABEL });
}
