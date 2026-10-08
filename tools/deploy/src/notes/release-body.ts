/**
 * The GitHub Release body as the owner's text plus sections the deploy tools own (an adopting app's "living report"):
 * the text between a section's two markers belongs to the tool that writes it, everything around it to whoever wrote
 * it, so a rerun replaces a section in place and keeps the owner's description above it. Sections stand in a fixed
 * order, so the body reads the same on every release: the release notes (`release-notes`, DF-1), the pipeline status
 * and the deployment history (`release-report`, DF-10).
 */
export const RELEASE_SECTION_KEYS = ["release-notes", "status", "deployments"] as const;

export type ReleaseSectionKey = (typeof RELEASE_SECTION_KEYS)[number];

export function getSectionMarkers(key: ReleaseSectionKey): { open: string; close: string } {
  return { open: `<!-- softure-deploy:${key} -->`, close: `<!-- /softure-deploy:${key} -->` };
}

export const RELEASE_SECTION_OPEN = getSectionMarkers("release-notes").open;
export const RELEASE_SECTION_CLOSE = getSectionMarkers("release-notes").close;

/** Start and end (after the closing marker) of the first `key` section, or null when the body has none. */
function findSection(body: string, key: ReleaseSectionKey): { start: number; end: number } | null {
  const { open, close } = getSectionMarkers(key);
  const start = body.indexOf(open);
  if (start === -1) return null;
  const closeAt = body.indexOf(close, start + open.length);
  if (closeAt === -1) return null;
  return { start, end: closeAt + close.length };
}

/** The content of the body's `key` section, trimmed, or null when the body has no such section. */
export function readSection(body: string, key: ReleaseSectionKey): string | null {
  const section = findSection(body, key);
  if (section === null) return null;
  const { open, close } = getSectionMarkers(key);
  return body.slice(section.start + open.length, section.end - close.length).trim();
}

/**
 * `body` with `content` in its `key` section: an existing section (the first opening marker up to the first closing
 * one after it) is replaced in place; a missing one goes before the first section that follows it in the fixed order,
 * else it is appended after a blank line.
 */
export function writeSection(body: string, key: ReleaseSectionKey, content: string): string {
  const { open, close } = getSectionMarkers(key);
  const block = `${open}\n${content.trim()}\n${close}`;
  const section = findSection(body, key);
  if (section !== null) return `${body.slice(0, section.start)}${block}${body.slice(section.end)}`;
  const later = RELEASE_SECTION_KEYS.slice(RELEASE_SECTION_KEYS.indexOf(key) + 1)
    .map((laterKey) => findSection(body, laterKey)?.start)
    .filter((start): start is number => start !== undefined);
  if (later.length > 0) {
    const at = Math.min(...later);
    return `${body.slice(0, at)}${block}\n\n${body.slice(at)}`;
  }
  const before = body.trimEnd();
  return before === "" ? `${block}\n` : `${before}\n\n${block}\n`;
}

/** The release report inside the body's `release-notes` section, trimmed, or null when the body has none. */
export function readReleaseSection(body: string): string | null {
  return readSection(body, "release-notes");
}

/** `body` with `report` in its `release-notes` section (see `writeSection`). */
export function writeReleaseSection(body: string, report: string): string {
  return writeSection(body, "release-notes", report);
}
