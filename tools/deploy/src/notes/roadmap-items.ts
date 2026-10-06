/**
 * The items a release ships, from a SOFTURE roadmap: the rows of its `## At a glance` table (ID, change, outcome,
 * …, status as the last cell) whose status is `done_code`, that is on the main branch and waiting for a release.
 * FIRE_TRACKER's report lists them above the pull requests.
 */
export interface RoadmapItem {
  id: string;
  changeId: string;
  outcome: string;
  status: string;
}

const ITEM_ID = /^[A-Z]{2,4}-\d+$/;
// `done kodowo` is the Polish status FIRE_TRACKER's older roadmaps used for the same state.
const SHIPPING_STATUS = /^(?:done_code|done kodowo)\b/i;

/** The cells of one table row; `\|` inside a cell is text, not a column border. */
function splitRow(row: string): string[] {
  return row
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split(/(?<!\\)\|/)
    .map((cell) => cell.trim());
}

function stripMarkup(cell: string): string {
  return cell.replace(/\*\*/g, "").replace(/`/g, "").trim();
}

/** The section from the `## At a glance` heading up to the next level-two heading. */
function findAtAGlance(markdown: string): string | null {
  const lines = markdown.split("\n");
  const start = lines.findIndex((line) => line.trim() === "## At a glance");
  if (start === -1) return null;
  const end = lines.findIndex((line, index) => index > start && line.startsWith("## "));
  return lines.slice(start + 1, end === -1 ? undefined : end).join("\n");
}

/** Every item row of the At a glance table; the header, the separator and other tables are skipped. */
export function parseRoadmapItems(markdown: string): RoadmapItem[] {
  const section = findAtAGlance(markdown);
  if (section === null) return [];
  const items: RoadmapItem[] = [];
  for (const line of section.split("\n")) {
    if (!line.trim().startsWith("|")) continue;
    const cells = splitRow(line);
    const id = stripMarkup(cells[0] ?? "");
    if (!ITEM_ID.test(id) || cells.length < 3) continue;
    items.push({
      id,
      changeId: stripMarkup(cells[1] ?? ""),
      outcome: cells[2] ?? "",
      status: stripMarkup(cells.at(-1) ?? ""),
    });
  }
  return items;
}

/** The items this release ships: `done_code`, not `done` (already released) nor anything still in progress. */
export function selectShippingItems(items: readonly RoadmapItem[]): RoadmapItem[] {
  return items.filter((item) => SHIPPING_STATUS.test(item.status));
}
