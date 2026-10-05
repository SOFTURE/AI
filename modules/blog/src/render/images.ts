// Images in article bodies under the app's image policy: one check for the renderer (emit or not) and
// the quality gate (report why not). An image follows the policy when its source stays on the site (a
// root-relative path) or comes over https from a host the app allows, its alt text is not empty and the
// app knows its width and height, so the page reserves its box before it loads.
import MarkdownIt from "markdown-it";
import footnote from "markdown-it-footnote";

export interface ImageDimensions {
  readonly width: number;
  readonly height: number;
}

export interface ArticleImagePolicy {
  /** Hosts whose https images are allowed besides the site's own paths (`cdn.example.com` covers its subdomains). */
  readonly hosts?: readonly string[];
  /**
   * Width and height in pixels of an allowed source, or `null` when the app does not know them. The
   * source is the normalised URL the page requests (percent-encoded: a space is `%20`).
   */
  readonly dimensions: (src: string) => ImageDimensions | null;
}

export type ImageProblem = "source" | "alt" | "dimensions";

export type ImageVerdict =
  | { readonly ok: true; readonly width: number; readonly height: number }
  | { readonly ok: false; readonly problems: readonly ImageProblem[] };

export interface ArticleImage {
  readonly src: string;
  readonly alt: string;
}

export interface FoundImage extends ArticleImage {
  /** 1-based line of the block that holds the image. */
  readonly line: number;
}

// A placeholder origin: a root-relative source must resolve to it, or it leaves the site.
const SITE_BASE = "https://site.invalid";

function isOnSite(src: string): boolean {
  if (!src.startsWith("/")) return false;
  try {
    return new URL(src, SITE_BASE).origin === SITE_BASE;
  } catch {
    return false;
  }
}

function isOnAllowedHost(src: string, hosts: readonly string[]): boolean {
  let url: URL;
  try {
    url = new URL(src);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.username !== "" || url.password !== "") return false;
  const host = url.hostname.toLowerCase();
  return hosts.some((allowed) => {
    const own = allowed.toLowerCase();
    return host === own || host.endsWith(`.${own}`);
  });
}

function isAllowedSource(src: string, policy: ArticleImagePolicy | undefined): boolean {
  if (policy === undefined) return false;
  return isOnSite(src) || isOnAllowedHost(src, policy.hosts ?? []);
}

function isPixelCount(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

/**
 * Whether an image follows the policy, and why not. Without a policy no image does. `dimensions` is
 * asked only for an allowed source; a throw there is the app's bug and propagates.
 */
export function checkArticleImage(image: ArticleImage, policy: ArticleImagePolicy | undefined): ImageVerdict {
  const problems: ImageProblem[] = [];
  const isAllowed = isAllowedSource(image.src, policy);
  if (!isAllowed) problems.push("source");
  if (image.alt.trim() === "") problems.push("alt");
  const size = isAllowed && policy !== undefined ? policy.dimensions(image.src) : null;
  const hasSize = size !== null && isPixelCount(size.width) && isPixelCount(size.height);
  if (isAllowed && !hasSize) problems.push("dimensions");
  if (problems.length > 0 || size === null) return { ok: false, problems };
  return { ok: true, width: size.width, height: size.height };
}

/**
 * The images of a text with their lines, for the quality gate. It parses like the renderer, but lets
 * every link scheme through, so an image the renderer would drop as text (`javascript:`) is listed and
 * reported too.
 */
export function findArticleImages(markdown: string): FoundImage[] {
  const md = new MarkdownIt({ html: false, linkify: false, typographer: false });
  md.use(footnote);
  md.validateLink = () => true;
  const images: FoundImage[] = [];
  for (const token of md.parse(markdown, {})) {
    if (token.type !== "inline" || token.children === null) continue;
    const line = (token.map?.[0] ?? 0) + 1;
    for (const child of token.children) {
      if (child.type !== "image") continue;
      images.push({ src: String(child.attrGet("src") ?? ""), alt: md.renderer.renderInlineAsText(child.children ?? [], md.options, {}), line });
    }
  }
  return images;
}
