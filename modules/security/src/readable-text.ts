// A fetched page as plain text for a model or a database: its title, its description, the text of its main
// content and the links in it, instead of raw HTML that costs thousands of tokens. Pure: the HTML is parsed into
// a static tree, so no script runs and nothing is loaded.
import { HTMLElement, NodeType, parse, TextNode, type Node } from "node-html-parser";

export interface ReadableLink {
  /** The link's text, or its `aria-label` or `title` when it has none. */
  readonly text: string;
  /** The absolute `http:` or `https:` URL. */
  readonly url: string;
}

export interface ReadableText {
  /** `<title>`, else `og:title`, else the first `h1`; `null` when the page has none. */
  readonly title: string | null;
  /** `<meta name="description">`, else `og:description`; `null` when the page has none. */
  readonly description: string | null;
  /** The main content as paragraphs separated by a blank line, list items as `- ` lines. */
  readonly text: string;
  /** The links in the main content, in order, each URL once. */
  readonly links: readonly ReadableLink[];
}

export interface ReadableTextOptions {
  /** The page's URL (the fetch's `finalUrl`): relative links resolve against it, or against the page's `<base>`. */
  readonly baseUrl: string;
}

/** Elements that are not content: code, embedded media, navigation, controls, and anything hidden. */
const NOT_CONTENT = [
  "script",
  "style",
  "noscript",
  "template",
  "svg",
  "canvas",
  "iframe",
  "object",
  "embed",
  "nav",
  "aside",
  "form",
  "button",
  "dialog",
  "select",
  "textarea",
  '[role="navigation"]',
  "[hidden]",
  '[aria-hidden="true"]',
];

/** A header or footer outside an article or a section is the page's banner or content info. */
const PAGE_LANDMARKS = "header, footer";
const SECTIONING_CONTENT = new Set(["ARTICLE", "SECTION"]);

const BLOCK_ELEMENTS = new Set([
  "ADDRESS", "ARTICLE", "BLOCKQUOTE", "BODY", "DD", "DETAILS", "DIV", "DL", "DT", "FIELDSET", "FIGCAPTION", "FIGURE",
  "FOOTER", "H1", "H2", "H3", "H4", "H5", "H6", "HEADER", "HR", "MAIN", "OL", "P", "PRE", "SECTION", "SUMMARY",
  "TABLE", "TBODY", "THEAD", "TFOOT", "TR", "UL",
]);
const CELL_ELEMENTS = new Set(["TD", "TH"]);
/** Marks a paragraph break while the text is built; never present in decoded text. */
const BREAK = "\u0000";

/**
 * The readable text of an HTML page: `main` (else `body`) is the content, narrowed to its only `article` when it
 * has exactly one; scripts, styles, navigation, forms, asides, hidden nodes and the page's own header and footer
 * are dropped. Links keep their text in place and are listed with absolute URLs; `javascript:`, `mailto:` and
 * links to a place on the same page are left out.
 */
export function htmlToReadableText(html: string, options: ReadableTextOptions): ReadableText {
  // `pre` is parsed as elements (its `code` and links count); script and style stay raw text, then are dropped.
  const document = parse(html, { comment: false, blockTextElements: { script: true, noscript: true, style: true } });
  const base = resolveBase(document, options.baseUrl);
  const title = readTitle(document);
  const description = readMeta(document, 'meta[name="description"]') ?? readMeta(document, 'meta[property="og:description"]');

  const root = selectContentRoot(document);
  for (const node of root.querySelectorAll(NOT_CONTENT.join(","))) {
    node.remove();
  }
  for (const node of root.querySelectorAll(PAGE_LANDMARKS)) {
    if (!isInSectioningContent(node, root)) {
      node.remove();
    }
  }

  return { title, description, text: buildText(root), links: collectLinks(root, base) };
}

function resolveBase(document: HTMLElement, baseUrl: string): URL | null {
  const page = parseUrl(baseUrl);
  const href = document.querySelector("base[href]")?.getAttribute("href");
  return (href === undefined ? null : parseUrl(href, page ?? undefined)) ?? page;
}

function readTitle(document: HTMLElement): string | null {
  const candidates = [
    document.querySelector("title")?.text,
    document.querySelector('meta[property="og:title"]')?.getAttribute("content"),
    document.querySelector("h1")?.text,
  ];
  for (const candidate of candidates) {
    const value = collapseWhitespace(candidate ?? "");
    if (value !== "") return value;
  }
  return null;
}

function readMeta(document: HTMLElement, selector: string): string | null {
  const value = collapseWhitespace(document.querySelector(selector)?.getAttribute("content") ?? "");
  return value === "" ? null : value;
}

function selectContentRoot(document: HTMLElement): HTMLElement {
  const outer = document.querySelector("main") ?? document.querySelector("body") ?? document;
  const articles = outer.querySelectorAll("article");
  const [only] = articles;
  return articles.length === 1 && only !== undefined ? only : outer;
}

/** Whether an article or a section holds the node, up to and including `root` (the article it was narrowed to). */
function isInSectioningContent(node: HTMLElement, root: HTMLElement): boolean {
  for (let parent = node.parentNode; parent !== null; parent = parent.parentNode) {
    if (SECTIONING_CONTENT.has(parent.tagName)) return true;
    if (parent === root) return false;
  }
  return false;
}

function buildText(root: HTMLElement): string {
  const parts: string[] = [];
  appendNode(root, parts, false);
  return parts
    .join("")
    .split(BREAK)
    .map((paragraph) =>
      paragraph
        .split("\n")
        .map((line) => line.replace(/^ (?=\S)/, "").trimEnd())
        .filter((line) => line.trim() !== "")
        .join("\n"),
    )
    .filter((paragraph) => paragraph !== "")
    .join("\n\n");
}

function appendNode(node: Node, parts: string[], isPreformatted: boolean): void {
  if (node.nodeType === NodeType.TEXT_NODE) {
    const text = (node as TextNode).text;
    const clean = text.replaceAll(BREAK, "");
    parts.push(isPreformatted ? clean : clean.replace(/\s+/g, " "));
    return;
  }
  if (!(node instanceof HTMLElement)) {
    return;
  }
  const tag = node.tagName;
  if (tag === "BR") {
    parts.push("\n");
    return;
  }
  if (tag === "LI") {
    const marker = node.parentNode?.tagName === "OL" ? `${String(listPosition(node))}. ` : "- ";
    parts.push(`\n${marker}`);
    appendChildren(node, parts, isPreformatted);
    parts.push("\n");
    return;
  }
  if (CELL_ELEMENTS.has(tag)) {
    // A space before every cell; the one before a row's first cell goes with the line's leading space.
    parts.push(" ");
    appendChildren(node, parts, isPreformatted);
    return;
  }
  const isBlock = BLOCK_ELEMENTS.has(tag);
  if (isBlock) parts.push(tag === "TR" ? "\n" : BREAK);
  appendChildren(node, parts, isPreformatted || tag === "PRE");
  if (isBlock) parts.push(tag === "TR" ? "\n" : BREAK);
}

function appendChildren(node: HTMLElement, parts: string[], isPreformatted: boolean): void {
  for (const child of node.childNodes) {
    appendNode(child, parts, isPreformatted);
  }
}

function listPosition(item: HTMLElement): number {
  const siblings = item.parentNode.childNodes.filter((child): child is HTMLElement => child instanceof HTMLElement && child.tagName === "LI");
  const start = Number.parseInt(item.parentNode.getAttribute("start") ?? "1", 10);
  return (Number.isNaN(start) ? 1 : start) + siblings.indexOf(item);
}

function collectLinks(root: HTMLElement, base: URL | null): ReadableLink[] {
  const links: ReadableLink[] = [];
  const seen = new Set<string>();
  for (const anchor of root.querySelectorAll("a[href]")) {
    const target = parseUrl(anchor.getAttribute("href")?.trim() ?? "", base ?? undefined);
    if (target === null || (target.protocol !== "http:" && target.protocol !== "https:")) continue;
    if (base !== null && target.hash !== "" && withoutHash(target) === withoutHash(base)) continue;
    const url = target.toString();
    if (seen.has(url)) continue;
    const text = collapseWhitespace(anchor.text) || collapseWhitespace(anchor.getAttribute("aria-label") ?? anchor.getAttribute("title") ?? "");
    seen.add(url);
    links.push({ text, url });
  }
  return links;
}

/** `URL.parse` without it: the package supports Node 22.0, where `URL.parse` is missing. */
function parseUrl(value: string, base?: URL): URL | null {
  try {
    return new URL(value, base);
  } catch {
    return null;
  }
}

function withoutHash(url: URL): string {
  return url.href.slice(0, url.href.length - url.hash.length);
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}
