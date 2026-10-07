// Article Markdown → HTML on the server. The output is a security boundary (stored XSS): whatever an
// author writes, the page injects the result as HTML.
//
// ## Allowlist by construction
//
// `html: false` escapes raw HTML in the text instead of passing it through, so the output holds only
// the elements markdown-it itself emits (headings, paragraphs, lists, quotes, tables, code, links,
// emphasis, footnotes, images). Links keep only `http(s)`, `mailto`, relative and `#` targets;
// `javascript:`, `data:` and every other scheme stay text.
//
// ## Images
//
// An image is emitted only when it follows the app's image policy (`images`, see `images.ts`): a site
// path or an https source on an allowed host, a non-empty alt and dimensions the app knows. It gets its
// width and height and loads lazily. Any other image renders as its alt text; without a policy, every one.
//
// ## Links
//
// A link that leaves the site (`siteHosts`, subdomains included) gets `rel="noopener noreferrer"`,
// opens in a new tab and carries a visible marker plus a visually hidden "opens in a new tab".
//
// ## Headings and the table of contents
//
// Every heading gets an id from its text, unique within the text (`-2`, `-3`), for a table of contents
// and for links to a section. `toc` renders that table as a `<nav>`.
//
// ## Glossary
//
// With `glossary`, the first mention of each term in prose links to its definition (`termHref`).
// Headings, existing links, code and footnotes are skipped: a link in a source would hide its address.
// A term does not link to itself (`selfSlug`). `linkedTerms` lists the terms the text links,
// automatically or by hand, so a term page knows which texts expand on it.
//
// ## Block plugins
//
// A fenced block whose type an app registers (```` ```chart ````) is rendered by the app's plugin, as
// HTML or as a node (e.g. a React server component). Plugin output is the app's own code and is
// trusted as is. Only top-level fences are plugin blocks; a fence inside a list or a quote stays code.
//
// A plugin with `syntax: "directive"` renders a leaf directive instead: a line of its own,
// `::chart{type="wealth" scenario="…"}` (braces optional), with double-quoted values and each key
// once. Like fences, only top-level lines count; a directive in a list, a quote or code stays text.
import MarkdownIt, { type MarkdownIt as Markdown, type StateCore, type Token } from "markdown-it";
import footnote from "markdown-it-footnote";
import type { BlogFields } from "../contract.js";
import { en } from "../messages/en.js";
import { createTermMatcher, type GlossaryTerm } from "./glossary.js";
import { checkArticleImage, type ArticleImagePolicy } from "./images.js";
import { getReadingMinutes } from "./reading-time.js";
import { slugifyHeading } from "./slugify-heading.js";

export type BlogRenderMessages = (typeof en)["render"];

export interface ArticleHeading {
  readonly level: number;
  readonly id: string;
  readonly text: string;
}

/** What a block plugin may read from its article; the page passes it in `options.article`. */
export interface BlockArticle {
  /** `current_as_of` of the article, `YYYY-MM-DD`. */
  readonly currentAsOf?: string;
  /** The app's own frontmatter fields (`blog({ fields })`). */
  readonly fields?: BlogFields;
}

/** How a block is written: a fence (```` ```chart ````) or a leaf directive (`::chart{…}`). */
export type BlockSyntax = "fence" | "directive";

/** A directive's attributes, or `null` when its braces cannot be read. Always `{}` for a fence. */
export type BlockAttributes = Readonly<Record<string, string>> | null;

export interface ArticleBlock {
  /** The block type: the first word of the fence's info string, or the directive's name. */
  readonly type: string;
  readonly syntax: BlockSyntax;
  /**
   * Fence: the rest of the info string, trimmed (```` ```chart wealth ```` → `"wealth"`). Directive:
   * the text inside the braces, trimmed.
   */
  readonly info: string;
  /** `key="value"` pairs of a directive; `{}` for a fence. */
  readonly attributes: BlockAttributes;
  /** Fence: its body, as written. Directive: the whole line, trimmed. */
  readonly content: string;
  readonly article: BlockArticle;
}

export type BlockOutput<TNode = unknown> =
  | { readonly kind: "html"; readonly html: string }
  | { readonly kind: "node"; readonly node: TNode };

export interface BlockPlugin<TNode = unknown> {
  /** Lower-case kebab-case, e.g. `chart`. */
  readonly type: string;
  /** Which blocks the plugin renders: fences (the default) or leaf directives. */
  readonly syntax?: BlockSyntax;
  /**
   * The frontmatter keys the block reads (`current_as_of` or keys of the app's `fields`), so the
   * quality gate can report a block whose article lacks them.
   */
  readonly requires?: readonly string[];
  /** Throws only on a bug; a block that cannot render returns its own error markup. */
  readonly render: (block: ArticleBlock) => BlockOutput<TNode>;
  /**
   * The block as Markdown for agents (`toArticleMarkdown`, `Accept: text/markdown`): a table or a
   * sentence. Without it the block's source stays in the Markdown.
   */
  readonly markdown?: (block: ArticleBlock) => string;
}

export type ArticleSegment<TNode = unknown> =
  | { readonly kind: "html"; readonly html: string }
  | { readonly kind: "node"; readonly type: string; readonly node: TNode };

export interface RenderArticleOptions<TNode = unknown> {
  /** Terms for automatic links; without it no text is linked. */
  readonly glossary?: readonly GlossaryTerm[];
  /** The slug of the term whose page is rendered: it does not link to itself. */
  readonly selfSlug?: string;
  /** The path of a term's definition; `/blog/glossary/<slug>` by default. */
  readonly termHref?: (slug: string) => string;
  /** Host names of the site (`example.com` covers its subdomains); other hosts are external. */
  readonly siteHosts?: readonly string[];
  /** Which images the body may show; without it every image renders as its alt text. */
  readonly images?: ArticleImagePolicy;
  readonly blocks?: readonly BlockPlugin<TNode>[];
  /** What block plugins may read from the article. */
  readonly article?: BlockArticle;
  /** Render a table of contents of `h2` down to `maxLevel` (3 by default). */
  readonly toc?: boolean | { readonly maxLevel: number };
  /** Copy for footnotes, external links and the table of contents; English by default. */
  readonly messages?: BlogRenderMessages;
  readonly wordsPerMinute?: number;
}

export interface RenderedArticle<TNode = unknown> {
  /** The whole body as one HTML string; `null` when a block plugin returned a node. */
  readonly html: string | null;
  /** The body in document order: HTML and the nodes of block plugins. */
  readonly segments: readonly ArticleSegment<TNode>[];
  readonly headings: readonly ArticleHeading[];
  /** The table of contents (`options.toc`), `null` when not asked for or without headings. */
  readonly toc: string | null;
  /** Slugs of the terms the text links, automatically or by hand, in order of the first link. */
  readonly linkedTerms: readonly string[];
  readonly readingMinutes: number;
}

export interface FoundBlock {
  readonly type: string;
  readonly syntax: BlockSyntax;
  readonly info: string;
  readonly attributes: BlockAttributes;
  /** 1-based line of the opening fence or of the directive. */
  readonly line: number;
  readonly requires: readonly string[];
}

const DEFAULT_TOC_MAX_LEVEL = 3;
const SAFE_SCHEME = /^(?:https?|mailto):/;
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/;
const BLOCK_TYPE = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const FOOTNOTES_HEADING_ID = "footnotes";
// Ids the renderer gives footnotes; a heading whose slug equals one of them gets a suffix.
const FOOTNOTE_ID = /^(?:footnotes|fn(?:ref)?-\d+(?:-\d+)?)$/;
const BLOCK_TOKEN = "blog_block";
const DIRECTIVE_LINE = /^::([a-z][a-z0-9]*(?:-[a-z0-9]+)*)(?:\{(.*)\})?$/;
const DIRECTIVE_START = /^::[a-z]/;
const DIRECTIVE_ATTRIBUTE = /\s*([a-z][a-z0-9_-]*)="([^"]*)"\s*/y;

interface BlockMeta {
  readonly type: string;
  readonly syntax: BlockSyntax;
  readonly info: string;
  readonly attributes: BlockAttributes;
}

/** The `key="value"` pairs inside a directive's braces; `null` when anything else is there or a key repeats. */
export function parseDirectiveAttributes(text: string): BlockAttributes {
  const attributes: Record<string, string> = {};
  DIRECTIVE_ATTRIBUTE.lastIndex = 0;
  let consumed = 0;
  for (let found = DIRECTIVE_ATTRIBUTE.exec(text); found !== null; found = DIRECTIVE_ATTRIBUTE.exec(text)) {
    const key = found[1] ?? "";
    if (Object.hasOwn(attributes, key)) return null;
    attributes[key] = found[2] ?? "";
    consumed = DIRECTIVE_ATTRIBUTE.lastIndex;
  }
  return text.slice(consumed).trim() === "" ? attributes : null;
}

/**
 * A line read as a leaf directive: its name, the text inside the braces and the attributes. `null`
 * for a line that is not one (a name must follow `::`); a directive whose braces do not close keeps
 * its name and gets `null` attributes.
 */
export function parseDirectiveLine(line: string): { readonly name: string; readonly info: string; readonly attributes: BlockAttributes } | null {
  const trimmed = line.trim();
  if (!DIRECTIVE_START.test(trimmed)) return null;
  const match = DIRECTIVE_LINE.exec(trimmed);
  if (match === null) {
    const name = /^::([a-z][a-z0-9-]*)/.exec(trimmed)?.[1] ?? "";
    const rest = trimmed.slice(2 + name.length).trim();
    return { name, info: rest.replace(/^\{/, "").trim(), attributes: null };
  }
  const info = (match[2] ?? "").trim();
  return { name: match[1] ?? "", info, attributes: parseDirectiveAttributes(info) };
}

function getDefaultTermHref(slug: string): string {
  return `/blog/glossary/${slug}`;
}

/** Percent-decoded where possible: markdown-it validates links after encoding them (`%09` for a tab). */
function decodeLink(url: string): string {
  try {
    return decodeURIComponent(url);
  } catch {
    return url;
  }
}

/** Without ASCII whitespace and control characters: browsers drop them inside a scheme (`java\tscript:`). */
function removeUrlNoise(url: string): string {
  return [...url].filter((char) => char > " " && char !== "\u007f").join("");
}

function isSafeLink(url: string): boolean {
  const value = removeUrlNoise(decodeLink(url)).toLowerCase();
  return SAFE_SCHEME.test(value) || !HAS_SCHEME.test(value);
}

function isExternalLink(href: string, siteHosts: readonly string[]): boolean {
  const absolute = href.startsWith("//") ? `https:${href}` : href;
  if (!/^https?:\/\//i.test(absolute)) return false;
  let host: string;
  try {
    host = new URL(absolute).hostname.toLowerCase();
  } catch {
    return true;
  }
  return !siteHosts.some((site) => {
    const own = site.toLowerCase();
    return host === own || host.endsWith(`.${own}`);
  });
}

/** A link target without its query, hash and trailing slash, for comparing paths. */
function getPathOnly(href: string): string {
  return href.replace(/[?#].*$/, "").replace(/(.)\/$/, "$1");
}

/** `[1, 0]` → `1`; later references to the same footnote → `1-2`, `1-3`. */
function getFootnoteRefId(meta: { id: number; subId: number }): string {
  const number = String(meta.id + 1);
  return meta.subId > 0 ? `${number}-${meta.subId + 1}` : number;
}

interface RenderState {
  readonly headings: ArticleHeading[];
  readonly linkedTerms: string[];
}

function addFootnoteMarkup(md: Markdown, messages: BlogRenderMessages): void {
  const escape = md.utils.escapeHtml;
  const rules = md.renderer.rules;
  rules.footnote_ref = (tokens, index) => {
    const meta = tokens[index]?.meta as { id: number; subId: number };
    const number = String(meta.id + 1);
    const label = escape(messages.footnoteLabel.replace("{number}", number));
    return `<sup class="blog-footnote-ref"><a href="#fn-${number}" id="fnref-${getFootnoteRefId(meta)}" aria-label="${label}">${number}</a></sup>`;
  };
  rules.footnote_block_open = () =>
    `<section class="blog-footnotes" aria-labelledby="${FOOTNOTES_HEADING_ID}">\n` +
    `<h2 id="${FOOTNOTES_HEADING_ID}">${escape(messages.footnotesHeading)}</h2>\n<ol>\n`;
  rules.footnote_block_close = () => "</ol>\n</section>\n";
  rules.footnote_open = (tokens, index) => `<li id="fn-${(tokens[index]?.meta as { id: number }).id + 1}">`;
  rules.footnote_close = () => "</li>\n";
  rules.footnote_anchor = (tokens, index) => {
    const meta = tokens[index]?.meta as { id: number; subId: number };
    return ` <a href="#fnref-${getFootnoteRefId(meta)}" class="blog-footnote-back" aria-label="${escape(messages.backToText)}">↩</a>`;
  };
}

function addExternalLinks(md: Markdown, siteHosts: readonly string[], messages: BlogRenderMessages): void {
  // Markdown links do not nest, but a stack keeps open and close paired whatever the token stream.
  const externalStack: boolean[] = [];
  md.renderer.rules.link_open = (tokens, index, options, _env, self) => {
    const token = tokens[index];
    const isExternal = token !== undefined && isExternalLink(String(token.attrGet("href") ?? ""), siteHosts);
    externalStack.push(isExternal);
    if (token !== undefined && isExternal) {
      token.attrSet("rel", "noopener noreferrer");
      token.attrSet("target", "_blank");
      token.attrJoin("class", "blog-external");
    }
    return self.renderToken(tokens, index, options);
  };
  md.renderer.rules.link_close = (tokens, index, options, _env, self) => {
    const marker = externalStack.pop() === true
      ? `<span class="blog-external-marker" aria-hidden="true">↗</span><span class="blog-visually-hidden"> ${md.utils.escapeHtml(messages.opensInNewTab)}</span>`
      : "";
    return marker + self.renderToken(tokens, index, options);
  };
}

/** Emits an image that follows the policy with its size and lazy loading; any other as its alt text. */
function addImages(md: Markdown, policy: ArticleImagePolicy | undefined): void {
  md.renderer.rules.image = (tokens, index, options, env, self) => {
    const token = tokens[index];
    if (token === undefined) return "";
    const alt = self.renderInlineAsText(token.children ?? [], options, env);
    const verdict = checkArticleImage({ src: String(token.attrGet("src") ?? ""), alt }, policy);
    if (!verdict.ok) return md.utils.escapeHtml(alt);
    token.attrSet("alt", alt);
    token.attrSet("width", String(verdict.width));
    token.attrSet("height", String(verdict.height));
    token.attrSet("loading", "lazy");
    token.attrSet("decoding", "async");
    token.attrJoin("class", "blog-image");
    return self.renderToken(tokens, index, options);
  };
}

function addHeadingIds(md: Markdown, state: RenderState): void {
  md.core.ruler.push("blog_heading_ids", (core) => {
    const used = new Map<string, number>();
    core.tokens.forEach((token, index) => {
      if (token.type !== "heading_open") return;
      const text =
        core.tokens[index + 1]?.children
          ?.filter((child) => child.type === "text" || child.type === "code_inline")
          .map((child) => child.content)
          .join("") ?? "";
      const base = slugifyHeading(text) || "section";
      const seen = used.get(base) ?? (FOOTNOTE_ID.test(base) ? 1 : 0);
      used.set(base, seen + 1);
      const id = seen === 0 ? base : `${base}-${seen + 1}`;
      token.attrSet("id", id);
      state.headings.push({ level: Number(token.tag.slice(1)), id, text });
    });
  });
}

interface GlossaryLinkOptions {
  readonly glossary: readonly GlossaryTerm[];
  readonly selfSlug: string | undefined;
  readonly termHref: (slug: string) => string;
}

function addGlossaryLinks(md: Markdown, options: GlossaryLinkOptions, state: RenderState): void {
  const terms = options.glossary.filter((term) => term.slug !== options.selfSlug);
  const match = createTermMatcher(terms);
  const slugByPath = new Map(options.glossary.map((term) => [getPathOnly(md.normalizeLink(options.termHref(term.slug))), term.slug]));
  const remember = (slug: string): void => {
    if (!state.linkedTerms.includes(slug)) state.linkedTerms.push(slug);
  };
  const newText = (core: StateCore, content: string): Token => {
    const token = new core.Token("text", "", 0);
    token.content = content;
    return token;
  };

  // Pushed after the footnote plugin's `footnote_tail`, so footnote bodies already sit between
  // `footnote_open` and `footnote_close` and can be skipped.
  md.core.ruler.push("blog_glossary_links", (core) => {
    let skipDepth = 0;
    for (const token of core.tokens) {
      if (token.type === "heading_open" || token.type === "footnote_open") {
        skipDepth += 1;
        continue;
      }
      if (token.type === "heading_close" || token.type === "footnote_close") {
        skipDepth -= 1;
        continue;
      }
      if (token.type !== "inline" || token.children === null) continue;
      let linkDepth = 0;
      const children: Token[] = [];
      for (const child of token.children) {
        if (child.type === "link_open") {
          linkDepth += 1;
          const slug = slugByPath.get(getPathOnly(String(child.attrGet("href") ?? "")));
          if (slug !== undefined && skipDepth === 0) remember(slug);
        } else if (child.type === "link_close") {
          linkDepth -= 1;
        }
        if (child.type !== "text" || linkDepth > 0 || skipDepth > 0) {
          children.push(child);
          continue;
        }
        let cursor = 0;
        for (const found of match(child.content)) {
          if (state.linkedTerms.includes(found.slug)) continue;
          remember(found.slug);
          if (found.index > cursor) children.push(newText(core, child.content.slice(cursor, found.index)));
          const open = new core.Token("link_open", "a", 1);
          open.attrSet("href", md.normalizeLink(options.termHref(found.slug)));
          open.attrSet("class", "blog-term");
          children.push(open, newText(core, found.text), new core.Token("link_close", "a", -1));
          cursor = found.index + found.text.length;
        }
        if (cursor === 0) {
          children.push(child);
        } else if (cursor < child.content.length) {
          children.push(newText(core, child.content.slice(cursor)));
        }
      }
      token.children = children;
    }
  });
}

/** Turns top-level fences of registered types into `blog_block` tokens. */
function addBlockTokens(md: Markdown, types: ReadonlySet<string>): void {
  md.core.ruler.push("blog_blocks", (core) => {
    for (const token of core.tokens) {
      if (token.type !== "fence" || token.level !== 0) continue;
      const [type = "", ...rest] = token.info.trim().split(/\s+/);
      if (!types.has(type)) continue;
      token.type = BLOCK_TOKEN;
      const meta: BlockMeta = { type, syntax: "fence", info: rest.join(" "), attributes: {} };
      token.meta = { block: meta };
    }
  });
}

/**
 * A block rule for top-level lines `::name{…}` of registered directive names. Before `paragraph`
 * and allowed to end one, so a directive right under a paragraph line is still a block.
 */
function addDirectiveRule(md: Markdown, names: ReadonlySet<string>): void {
  if (names.size === 0) return;
  md.block.ruler.before(
    "paragraph",
    "blog_directive",
    (state, startLine, _endLine, silent) => {
      // Four spaces are an indented code block; a nested block (list, quote) is not top level.
      if (state.level !== 0 || state.blkIndent !== 0 || (state.sCount[startLine] ?? 0) - state.blkIndent >= 4) return false;
      const line = state.src.slice((state.bMarks[startLine] ?? 0) + (state.tShift[startLine] ?? 0), state.eMarks[startLine]);
      const directive = parseDirectiveLine(line);
      if (directive === null || !names.has(directive.name)) return false;
      if (!silent) {
        const token = state.push(BLOCK_TOKEN, "", 0);
        token.block = true;
        token.content = line.trim();
        token.map = [startLine, startLine + 1];
        const meta: BlockMeta = { type: directive.name, syntax: "directive", info: directive.info, attributes: directive.attributes };
        token.meta = { block: meta };
      }
      state.line = startLine + 1;
      return true;
    },
    { alt: ["paragraph"] },
  );
}

/** The block a `blog_block` token stands for; set by `addBlockTokens` and `addDirectiveRule`. */
function readBlockMeta(token: Token): BlockMeta {
  return (token.meta as { block: BlockMeta }).block;
}

/** Plugins by `syntax:type`. */
type PluginRegistry<TNode> = Map<string, BlockPlugin<TNode>>;

function getPluginKey(syntax: BlockSyntax, type: string): string {
  return `${syntax}:${type}`;
}

function getPluginsByType<TNode>(plugins: readonly BlockPlugin<TNode>[]): PluginRegistry<TNode> {
  const byType: PluginRegistry<TNode> = new Map();
  for (const plugin of plugins) {
    if (!BLOCK_TYPE.test(plugin.type)) {
      throw new Error(`Block plugin type "${plugin.type}" must be lower-case kebab-case, e.g. "chart".`);
    }
    const syntax = plugin.syntax ?? "fence";
    const key = getPluginKey(syntax, plugin.type);
    if (byType.has(key)) {
      throw new Error(syntax === "fence" ? `Block plugin type "${plugin.type}" is registered twice.` : `Block plugin type "${plugin.type}" (directive) is registered twice.`);
    }
    byType.set(key, plugin);
  }
  return byType;
}

function getTypes<TNode>(plugins: PluginRegistry<TNode>, syntax: BlockSyntax): Set<string> {
  return new Set([...plugins.values()].filter((plugin) => (plugin.syntax ?? "fence") === syntax).map((plugin) => plugin.type));
}

function createMarkdown<TNode>(
  options: RenderArticleOptions<TNode>,
  plugins: PluginRegistry<TNode>,
  state: RenderState,
): Markdown {
  const messages = options.messages ?? en.render;
  const md = new MarkdownIt({ html: false, linkify: true, typographer: false });
  md.use(footnote);
  md.validateLink = isSafeLink;
  addImages(md, options.images);
  addFootnoteMarkup(md, messages);
  addExternalLinks(md, options.siteHosts ?? [], messages);
  addBlockTokens(md, getTypes(plugins, "fence"));
  addDirectiveRule(md, getTypes(plugins, "directive"));
  addHeadingIds(md, state);
  addGlossaryLinks(
    md,
    { glossary: options.glossary ?? [], selfSlug: options.selfSlug, termHref: options.termHref ?? getDefaultTermHref },
    state,
  );
  return md;
}

function renderTableOfContents(md: Markdown, headings: readonly ArticleHeading[], maxLevel: number, label: string): string | null {
  const items = headings.filter((heading) => heading.level >= 2 && heading.level <= maxLevel);
  const first = items[0];
  if (first === undefined) return null;
  const escape = md.utils.escapeHtml;
  const levels = [first.level];
  let html = "";
  items.forEach((heading, index) => {
    if (index > 0) {
      if (heading.level > (levels.at(-1) ?? heading.level)) {
        html += "<ol>";
        levels.push(heading.level);
      } else {
        html += "</li>";
        while (levels.length > 1 && heading.level < (levels.at(-1) ?? heading.level)) {
          html += "</ol></li>";
          levels.pop();
        }
      }
    }
    html += `<li><a href="#${escape(heading.id)}">${escape(heading.text)}</a>`;
  });
  html += "</li>" + "</ol></li>".repeat(levels.length - 1);
  return `<nav class="blog-toc" aria-label="${escape(label)}"><ol>${html}</ol></nav>\n`;
}

function addHtmlSegment<TNode>(segments: ArticleSegment<TNode>[], html: string): void {
  if (html === "") return;
  const last = segments.at(-1);
  if (last?.kind === "html") {
    segments[segments.length - 1] = { kind: "html", html: last.html + html };
  } else {
    segments.push({ kind: "html", html });
  }
}

export function renderArticle<TNode = unknown>(markdown: string, options: RenderArticleOptions<TNode> = {}): RenderedArticle<TNode> {
  const plugins = getPluginsByType(options.blocks ?? []);
  const state: RenderState = { headings: [], linkedTerms: [] };
  const md = createMarkdown(options, plugins, state);
  const env = {};
  const tokens = md.parse(markdown, env);

  const segments: ArticleSegment<TNode>[] = [];
  let start = 0;
  tokens.forEach((token, index) => {
    if (token.type !== BLOCK_TOKEN) return;
    addHtmlSegment(segments, md.renderer.render(tokens.slice(start, index), md.options, env));
    start = index + 1;
    const meta = readBlockMeta(token);
    const plugin = plugins.get(getPluginKey(meta.syntax, meta.type));
    if (plugin === undefined) return;
    const output = plugin.render({ ...meta, content: token.content, article: options.article ?? {} });
    if (output.kind === "html") {
      addHtmlSegment(segments, output.html);
    } else {
      segments.push({ kind: "node", type: meta.type, node: output.node });
    }
  });
  addHtmlSegment(segments, md.renderer.render(tokens.slice(start), md.options, env));

  const hasNodes = segments.some((segment) => segment.kind === "node");
  const html = hasNodes ? null : segments.map((segment) => (segment.kind === "html" ? segment.html : "")).join("");
  const toc =
    options.toc === undefined || options.toc === false
      ? null
      : renderTableOfContents(
          md,
          state.headings,
          options.toc === true ? DEFAULT_TOC_MAX_LEVEL : options.toc.maxLevel,
          (options.messages ?? en.render).tableOfContents,
        );
  return {
    html,
    segments,
    headings: state.headings,
    toc,
    linkedTerms: state.linkedTerms,
    readingMinutes: getReadingMinutes(markdown, options.wordsPerMinute),
  };
}

/** The plugin blocks a text uses, without rendering it: for the quality gate (BL-6). */
export function findArticleBlocks(markdown: string, plugins: readonly BlockPlugin[]): FoundBlock[] {
  const byType = getPluginsByType(plugins);
  const md = createMarkdown({ blocks: plugins }, byType, { headings: [], linkedTerms: [] });
  return md.parse(markdown, {}).flatMap((token) => {
    if (token.type !== BLOCK_TOKEN) return [];
    const meta = readBlockMeta(token);
    const requires = byType.get(getPluginKey(meta.syntax, meta.type))?.requires ?? [];
    return [{ type: meta.type, syntax: meta.syntax, info: meta.info, attributes: meta.attributes, line: (token.map?.[0] ?? 0) + 1, requires }];
  });
}
