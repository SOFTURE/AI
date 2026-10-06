/**
 * The release report as one section of a longer GitHub Release body (FIRE_TRACKER's "living report"): the text
 * between the two markers belongs to `release-notes`, everything around it to whoever wrote it, so a rerun replaces
 * the report in place and keeps the owner's description above it.
 */
export const RELEASE_SECTION_OPEN = "<!-- softure-deploy:release-notes -->";
export const RELEASE_SECTION_CLOSE = "<!-- /softure-deploy:release-notes -->";

/** Start and end (after the closing marker) of the first section, or null when the body has none. */
function findSection(body: string): { start: number; end: number } | null {
  const start = body.indexOf(RELEASE_SECTION_OPEN);
  if (start === -1) return null;
  const close = body.indexOf(RELEASE_SECTION_CLOSE, start + RELEASE_SECTION_OPEN.length);
  if (close === -1) return null;
  return { start, end: close + RELEASE_SECTION_CLOSE.length };
}

/** The report inside the body's section, trimmed, or null when the body has no section. */
export function readReleaseSection(body: string): string | null {
  const section = findSection(body);
  if (section === null) return null;
  return body.slice(section.start + RELEASE_SECTION_OPEN.length, section.end - RELEASE_SECTION_CLOSE.length).trim();
}

/**
 * `body` with `report` in its section: an existing section (the first opening marker up to the first closing one
 * after it) is replaced in place; otherwise the section is appended after a blank line.
 */
export function writeReleaseSection(body: string, report: string): string {
  const block = `${RELEASE_SECTION_OPEN}\n${report.trim()}\n${RELEASE_SECTION_CLOSE}`;
  const section = findSection(body);
  if (section !== null) return `${body.slice(0, section.start)}${block}${body.slice(section.end)}`;
  const before = body.trimEnd();
  return before === "" ? `${block}\n` : `${before}\n\n${block}\n`;
}
