// The social card of an article (`opengraph-image`): its title on the brand's background, the brand's
// name above and the blog's name below. Mount it in `app/blog/[slug]/opengraph-image.tsx`:
//
//   export { BlogArticleOgImage as default, generateBlogStaticParams as generateStaticParams } from "@softure-ai/blog/next";
//   export const size = { width: 1200, height: 630 };
//   export const contentType = "image/png";
//   export const revalidate = 300;
//
// A slug that is not a published article gets the blog's own card, never a 404: a crawler that
// fetched the page earlier would show an empty preview.
//
// The card writes in `blog({ brand: { fonts } })` when the app lists them (`next/og`'s default font
// otherwise): each file is read on the first card and kept, and a file that cannot be read fails the
// card with a message naming it. A path is read from the app's root on the Node.js runtime (the
// route's default); a route moved to the edge runtime takes https URLs only.
//
// An app with its own mark builds the route with `createBlogArticleOgImage`, in the same file:
//
//   export default createBlogArticleOgImage({ logo: <AppMark />, label: "The app's journal" });
//
// The logo is drawn before the brand's name; the label line is in `brand.colors.muted`.
import { formatMessage, type SoftureConfig } from "@softure-ai/core";
import { getSoftureConfig } from "@softure-ai/core/next";
import { DEFAULT_THEME } from "@softure-ai/ui";
import { ImageResponse } from "next/og";
import type { ReactNode } from "react";
import type { BlogOptions } from "../options.js";
import type { OgFont } from "../server/og-fonts.js";
import { getBlogOptions } from "../server/options.js";
import { getPageContext } from "./context.js";
import { getTextBySlug } from "./data.js";
import { loadBrandOgFonts } from "./og-fonts.js";

export type { OgFont } from "../server/og-fonts.js";

/** The card's size: the 1.91:1 every network crops to. */
export const OG_IMAGE_SIZE = { width: 1200, height: 630 } as const;


export interface RenderArticleOgImageInput {
  readonly title: string;
  /** Under the title: the blog's name. */
  readonly label: string;
  readonly brand: BlogOptions["brand"];
  /** Fonts for the card; `next/og`'s default font otherwise. */
  readonly fonts?: readonly OgFont[];
  /** The app's mark before the brand's name: an element `next/og` draws (flex layout, inline styles, data or https images). */
  readonly logo?: ReactNode;
}

export interface OgColors {
  readonly background: string;
  readonly foreground: string;
  readonly accent: string;
  /** The label line. */
  readonly muted: string;
}

/** The card's colours: the brand's, else the dark scheme of @softure-ai/ui's default theme; `muted` falls back to the foreground. */
export function getOgColors(brand: BlogOptions["brand"]): OgColors {
  const dark = DEFAULT_THEME.dark;
  const foreground = brand?.colors?.foreground ?? dark["color-foreground"];
  return {
    background: brand?.colors?.background ?? dark["color-background"],
    foreground,
    accent: brand?.colors?.accent ?? dark["color-accent-fill"],
    muted: brand?.colors?.muted ?? foreground,
  };
}

/**
 * The card's `font-family`: every family it is given, once each and in order, so a second family (a
 * `latin-ext` subset file under its own name) draws the characters the first lacks.
 */
export function getOgFontFamily(fonts: readonly OgFont[]): string | undefined {
  const names = [...new Set(fonts.map((font) => font.name))];
  return names.length === 0 ? undefined : names.map((name) => JSON.stringify(name)).join(", ");
}

export function renderArticleOgImage({ title, label, brand, fonts, logo }: RenderArticleOgImageInput): ImageResponse {
  const colors = getOgColors(brand);
  const fontFamily = getOgFontFamily(fonts ?? []);
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: colors.background,
          color: colors.foreground,
          padding: "56px 72px 64px",
          ...(fontFamily === undefined ? {} : { fontFamily }),
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 34, fontWeight: 700 }}>
          {logo === undefined ? null : logo}
          {brand?.name ?? ""}
        </div>
        <div style={{ display: "flex", fontSize: title.length > 60 ? 56 : 68, fontWeight: 700, lineHeight: 1.08 }}>{title}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 28, color: colors.muted }}>
          <div style={{ display: "flex", width: 12, height: 12, borderRadius: 2, background: colors.accent }} />
          <div style={{ display: "flex" }}>{label}</div>
        </div>
      </div>
    ),
    { ...OG_IMAGE_SIZE, ...(fonts === undefined ? {} : { fonts: [...fonts] }) },
  );
}

function getLabel(config: SoftureConfig): string {
  const context = getPageContext(config);
  const name = context.messages.pages.blogTitle;
  return context.brand === null ? name : formatMessage(context.messages.pages.titleWithBrand, { title: name, brand: context.brand });
}

export interface BlogArticleOgImageOptions {
  /** The app's mark before the brand's name. */
  readonly logo?: ReactNode;
  /** The line under the title (and the title of the blog's own card); the blog's name with the brand by default. */
  readonly label?: string;
}

type OgImageRoute = (props: { readonly params: Promise<{ readonly slug: string }> }) => Promise<ImageResponse>;

/** The default export of an article's `opengraph-image.tsx`, with the app's logo and label. */
export function createBlogArticleOgImage(options: BlogArticleOgImageOptions = {}): OgImageRoute {
  return async ({ params }) => {
    const config = getSoftureConfig();
    const { slug } = await params;
    const article = await getTextBySlug(config, slug);
    const isVisible = article !== null && article.status === "published" && article.kind === "article";
    const label = options.label ?? getLabel(config);
    const { brand } = getBlogOptions(config);
    const fonts = await loadBrandOgFonts(brand?.fonts ?? []);
    if (!fonts.ok) throw new Error(fonts.error);
    return renderArticleOgImage({
      title: isVisible ? article.title : label,
      label,
      brand,
      fonts: fonts.fonts.length === 0 ? undefined : fonts.fonts,
      logo: options.logo,
    });
  };
}

/** The default export of an article's `opengraph-image.tsx`. */
export const BlogArticleOgImage: OgImageRoute = createBlogArticleOgImage();
