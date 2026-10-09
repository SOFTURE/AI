// A rendered page as Markdown for agents. The source is the page's own HTML, not a second text kept
// next to it: copy that lives only in components would drift from a hand-written Markdown at the
// first edit. The main element is taken, and what serves the page rather than its content is dropped.
import { NodeHtmlMarkdown } from "node-html-markdown";
import { HTMLElement, parse } from "node-html-parser";

/**
 * Elements without content for an agent: navigation, controls, graphics (a chart worth reading has a
 * table next to it) and anything hidden from screen readers.
 */
const NOT_CONTENT = [
  "nav",
  "script",
  "style",
  "svg",
  "noscript",
  "template",
  "button",
  "form",
  "dialog",
  "[hidden]",
  '[aria-hidden="true"]',
];

export interface HtmlToMarkdownOptions {
  /** The element whose content is converted, a CSS selector; `null` converts the whole input (a fragment). */
  readonly root?: string | null;
  /** The public origin: root-relative links and images become absolute on it (an agent reads off the page). */
  readonly origin?: string;
  /** The page's URL for the frontmatter, used when the page has no canonical link. */
  readonly url?: string;
  /** More selectors to drop, e.g. a footnote's back link or a table of contents. */
  readonly remove?: readonly string[];
  /** `false` leaves out the `title` / `description` / `url` frontmatter. */
  readonly frontmatter?: boolean;
}

/**
 * A header or footer in the root, also inside a layout wrapper, is the page's banner or content info; one
 * inside an article, a section or an aside is content (an article's title and byline), so it stays.
 */
const PAGE_LANDMARKS = "header, footer";
const SECTIONING_CONTENT = new Set(["ARTICLE", "SECTION", "ASIDE"]);

/**
 * The Markdown of a page's root element (`main` by default), after a frontmatter of `title`,
 * `description` and `url`. `null` when the page has no root element: a caller should then answer
 * with the page, not with Markdown of its header and footer.
 */
export function htmlToMarkdown(html: string, options: HtmlToMarkdownOptions = {}): string | null {
  const { root: rootSelector = "main", origin, url, remove = [], frontmatter = true } = options;
  const document = parse(html);
  const root = rootSelector === null ? document : document.querySelector(rootSelector);
  if (root === null) {
    return null;
  }

  for (const node of root.querySelectorAll([...NOT_CONTENT, ...remove].join(","))) {
    node.remove();
  }
  for (const node of root.querySelectorAll(PAGE_LANDMARKS)) {
    if (!isInSectioningContent(node, root)) {
      node.remove();
    }
  }
  if (origin !== undefined) {
    absolutize(root, origin);
  }

  const body = NodeHtmlMarkdown.translate(root.innerHTML).trim();
  const text = body === "" ? "" : `${body}\n`;
  return frontmatter ? `${buildFrontmatter(document, { origin, url })}\n\n${text}` : text;
}

/** Whether an article, a section or an aside between `node` and `root` holds the node. */
function isInSectioningContent(node: HTMLElement, root: HTMLElement): boolean {
  for (let parent = node.parentNode; parent !== null && parent !== root; parent = parent.parentNode) {
    if (SECTIONING_CONTENT.has(parent.tagName)) return true;
  }
  return false;
}

function buildFrontmatter(document: HTMLElement, { origin, url }: { origin: string | undefined; url: string | undefined }): string {
  const title = document.querySelector("title")?.text.trim() ?? "";
  const description = readAttribute(document, 'meta[name="description"]', "content");
  const canonical = readAttribute(document, 'link[rel="canonical"]', "href");
  const base = origin ?? url;
  const pageUrl = canonical !== null && (base !== undefined || URL.canParse(canonical)) ? new URL(canonical, base).toString() : url;
  if (pageUrl === undefined) {
    throw new Error("htmlToMarkdown: the frontmatter needs the page's url; pass `url` (or `frontmatter: false`)");
  }
  return [
    "---",
    ...(title === "" ? [] : [toFrontmatterLine("title", title)]),
    ...(description === null ? [] : [toFrontmatterLine("description", description)]),
    toFrontmatterLine("url", pageUrl),
    "---",
  ].join("\n");
}

function readAttribute(document: HTMLElement, selector: string, attribute: string): string | null {
  const value = document.querySelector(selector)?.getAttribute(attribute)?.trim();
  return value === undefined || value === "" ? null : value;
}

/** A JSON-quoted value: a colon or a quote in a title cannot break the YAML. */
function toFrontmatterLine(key: string, value: string): string {
  return `${key}: ${JSON.stringify(value)}`;
}

function absolutize(root: HTMLElement, origin: string): void {
  for (const [selector, attribute] of [["a[href]", "href"], ["img[src]", "src"]] as const) {
    for (const node of root.querySelectorAll(selector)) {
      const value = node.getAttribute(attribute) ?? "";
      if (value.startsWith("/") && !value.startsWith("//")) {
        node.setAttribute(attribute, new URL(value, origin).toString());
      }
    }
  }
}
