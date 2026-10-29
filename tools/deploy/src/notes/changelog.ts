// The changelog a build embeds and the build info route answers: the finished items of the newest roadmaps, read from
// the working tree before `next build`. Ids, change ids and status only: the route is public.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseRoadmapItems } from "./roadmap-items.js";
import { isArchivedRoadmap, MAIN_ROADMAP, ROADMAP_ARCHIVE, sortArchivedRoadmaps } from "./roadmap-files.js";

export type ChangelogStatus = "done" | "done_code";

export interface ChangelogItem {
  id: string;
  changeId: string;
  status: ChangelogStatus;
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

/** The finished items (`done`, `done_code`) of one roadmap's At a glance table, in table order. */
export function selectChangelogItems(markdown: string): ChangelogItem[] {
  const items: ChangelogItem[] = [];
  for (const item of parseRoadmapItems(markdown)) {
    const status = toChangelogStatus(item.status);
    if (status !== null) items.push({ id: item.id, changeId: item.changeId, status });
  }
  return items;
}

/** The changelog of the newest `limit` roadmaps under `cwd`; none is an empty list. */
export function readChangelog(cwd: string, limit = DEFAULT_CHANGELOG_ROADMAPS): ChangelogRoadmap[] {
  return listChangelogRoadmaps(cwd, limit).map((roadmap) => ({
    roadmap,
    items: selectChangelogItems(readFileSync(join(cwd, roadmap), "utf8")),
  }));
}
