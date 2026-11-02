// The changelog a build embeds and the build info route answers: the finished items of the newest roadmaps, read from
// the working tree before `next build`. Ids, change ids and status by default: the route is public, so another column
// is added only when the app names it.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { readCellText, readRoadmapTable } from "./roadmap-items.js";
import { isArchivedRoadmap, MAIN_ROADMAP, ROADMAP_ARCHIVE, sortArchivedRoadmaps } from "./roadmap-files.js";

export type ChangelogStatus = "done" | "done_code";

export interface ChangelogItem {
  id: string;
  changeId: string;
  status: ChangelogStatus;
  /** The roadmap columns the app named (issue #922), by the name it gave; a column the table lacks is left out. */
  fields?: Record<string, string>;
}

export interface ChangelogRoadmap {
  /** The roadmap's path from the project root. */
  roadmap: string;
  items: ChangelogItem[];
}

export const DEFAULT_CHANGELOG_ROADMAPS = 2;

// `done kodowo` is the Polish status older roadmaps of an adopting app used for done_code.
const DONE_CODE = /^(?:done_code|done kodowo)\b/i;
const DONE = /^done\b/i;

function toChangelogStatus(status: string): ChangelogStatus | null {
  if (DONE_CODE.test(status)) return "done_code";
  return DONE.test(status) ? "done" : null;
}

/** The open roadmap (when there is one), then the archived ones newest first, at most `limit` paths. */
export function listChangelogRoadmaps(cwd: string, limit: number): string[] {
  const paths = existsSync(join(cwd, MAIN_ROADMAP)) ? [MAIN_ROADMAP] : [];
  const archiveDir = join(cwd, ROADMAP_ARCHIVE);
  const archived = existsSync(archiveDir)
    ? readdirSync(archiveDir)
        .map((name) => `${ROADMAP_ARCHIVE}/${name}`)
        .filter(isArchivedRoadmap)
    : [];
  return [...paths, ...sortArchivedRoadmaps(archived).reverse()].slice(0, limit);
}

/**
 * The finished items (`done`, `done_code`) of one roadmap's At a glance table, in table order. `fields` names more
 * columns to copy (header names, any case); without it an item carries no `fields`.
 */
export function selectChangelogItems(markdown: string, fields: readonly string[] = []): ChangelogItem[] {
  const table = readRoadmapTable(markdown);
  const header = table.header.map((name) => name.toLowerCase());
  const columns = fields.map((name) => ({ name, index: header.indexOf(name.toLowerCase()) }));
  const items: ChangelogItem[] = [];
  for (const cells of table.rows) {
    const status = toChangelogStatus(readCellText(cells.at(-1) ?? ""));
    if (status === null) continue;
    const item: ChangelogItem = { id: readCellText(cells[0] ?? ""), changeId: readCellText(cells[1] ?? ""), status };
    if (fields.length > 0) {
      item.fields = Object.fromEntries(
        columns.filter(({ index }) => index !== -1 && index < cells.length).map(({ name, index }) => [name, readCellText(cells[index] ?? "")]),
      );
    }
    items.push(item);
  }
  return items;
}

/** The changelog of the newest `limit` roadmaps under `cwd`, with the named extra columns; none is an empty list. */
export function readChangelog(cwd: string, limit = DEFAULT_CHANGELOG_ROADMAPS, fields: readonly string[] = []): ChangelogRoadmap[] {
  return listChangelogRoadmaps(cwd, limit).map((roadmap) => ({
    roadmap,
    items: selectChangelogItems(readFileSync(join(cwd, roadmap), "utf8"), fields),
  }));
}
