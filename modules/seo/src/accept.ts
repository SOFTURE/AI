// Content negotiation for the Markdown version of a page: which requests ask for Markdown.

interface MediaRange {
  readonly type: string;
  readonly subtype: string;
  readonly q: number;
}

function parseAccept(accept: string): MediaRange[] {
  return accept.split(",").flatMap((part) => {
    const [range = "", ...params] = part.trim().toLowerCase().split(";");
    const [type, subtype] = range.trim().split("/");
    if (type === undefined || type === "" || subtype === undefined || subtype === "") return [];
    const qParam = params.map((param) => param.trim()).find((param) => param.startsWith("q="));
    const q = qParam === undefined ? 1 : Number(qParam.slice(2));
    return Number.isFinite(q) ? [{ type, subtype, q }] : [];
  });
}

/** The weight of a type by the most specific matching range (RFC 9110 §12.5.1); 0 without a match. */
function getQuality(ranges: readonly MediaRange[], type: string, subtype: string): number {
  const exact = ranges.find((range) => range.type === type && range.subtype === subtype);
  const group = ranges.find((range) => range.type === type && range.subtype === "*");
  const any = ranges.find((range) => range.type === "*" && range.subtype === "*");
  return (exact ?? group ?? any)?.q ?? 0;
}

/**
 * Whether an `Accept` header asks for Markdown rather than HTML. `text/markdown` must be named: `*\/*`
 * (curl, most crawlers, browser prefetches) matches Markdown as well as HTML, and they want the page.
 * A tie goes to Markdown: a client that names it next to HTML with the same weight is an agent.
 * The same rule as `@softure-ai/blog`, so both answer a client alike.
 */
export function prefersMarkdown(accept: string | null): boolean {
  if (accept === null) return false;
  const ranges = parseAccept(accept);
  const markdown = ranges.find((range) => range.type === "text" && range.subtype === "markdown");
  if (markdown === undefined || markdown.q <= 0) return false;
  return markdown.q >= getQuality(ranges, "text", "html");
}
