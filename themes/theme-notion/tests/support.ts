/** The text nodes of rendered markup, in order and trimmed: what a reader sees, without the tags. */
export function readTextNodes(html: string): string[] {
  return [...html.matchAll(/>([^<]+)</g)].map((match) => (match[1] ?? "").trim()).filter((text) => text !== "");
}
