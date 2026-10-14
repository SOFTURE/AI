/**
 * Where a SOFTURE project keeps its roadmap: `context/foundation/roadmap.md` while it is open, then
 * `context/foundation/archive/<YYYY-MM-DD>[-N]-roadmap.md` once it is closed (`-2`, `-3`… for a second roadmap closed
 * the same day).
 */
export const MAIN_ROADMAP = "context/foundation/roadmap.md";
export const ROADMAP_ARCHIVE = "context/foundation/archive";

const ARCHIVED_ROADMAP = /^context\/foundation\/archive\/(\d{4}-\d{2}-\d{2})(?:-(\d+))?-roadmap\.md$/;

export function isArchivedRoadmap(path: string): boolean {
  return ARCHIVED_ROADMAP.test(path);
}

function getSortKey(path: string): [string, number] {
  const match = ARCHIVED_ROADMAP.exec(path);
  return [match?.[1] ?? "", Number(match?.[2] ?? 1)];
}

/** Archived roadmaps, oldest first: by closing date, then by the same-day counter (none counts as 1). */
export function sortArchivedRoadmaps(paths: readonly string[]): string[] {
  return [...paths].sort((left, right) => {
    const [leftDate, leftCounter] = getSortKey(left);
    const [rightDate, rightCounter] = getSortKey(right);
    return leftDate === rightDate ? leftCounter - rightCounter : leftDate < rightDate ? -1 : 1;
  });
}
