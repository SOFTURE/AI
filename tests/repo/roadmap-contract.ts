// The roadmap format orchestrators and scripts parse (WORKFLOW.md §5 in @softure-ai/skills).

export interface RoadmapEntry {
  id: string;
  changeId: string;
  status: string;
  line: number;
}

export interface ParsedRoadmap {
  rows: RoadmapEntry[];
  blocks: RoadmapEntry[];
  /** IDs whose `### <ID>:` heading exists but whose block does not parse. */
  malformedBlockIds: string[];
  /** Lines that look like rows or blocks but do not parse, with a message each. */
  problems: string[];
}

const ROW_START = /^\| \*\*/;
const ROW = /^\| \*\*([A-Z]+-\d+)\*\* \| `([^`]+)` \|.*\|\s*([^|]+?)\s*\|\s*$/;
const BLOCK_HEADING = /^### ([A-Z]+-\d+):/;
const BLOCK_CHANGE_ID = /^- \*\*Change ID:\*\* `([^`]+)`\s*$/;
const BLOCK_STATUS = /^- \*\*Status:\*\* (.+?)\s*$/;

const DATE = String.raw`\d{4}-\d{2}-\d{2}`;
const STAGE = String.raw`(?:research|frame|plan|plan-review|implement \d+/\d+|impl-review|integration|archive)`;
const STATUS = new RegExp(
  "^(?:" +
    [
      "proposed",
      "ready",
      "done",
      String.raw`blocked \(.+\)`,
      String.raw`in_progress \(${STAGE}, since ${DATE}; .+\)`,
      String.raw`ready_to_merge \(since ${DATE}; .+\)`,
      String.raw`done_code \(${DATE}; waiting: .+\)`,
    ].join("|") +
    ")$",
);
const QUEUED_STATUSES = new Set(["proposed", "ready", "blocked"]);

/** Orchestrators bold the keyword in the row (`**in_progress** (…)`) but not in the block. */
function normalizeStatus(status: string): string {
  return status.replaceAll("**", "").trim();
}

function getStatusKeyword(status: string): string {
  return status.split(" ")[0] ?? status;
}

export function parseRoadmap(text: string): ParsedRoadmap {
  const lines = text.split("\n");
  const rows: RoadmapEntry[] = [];
  const blocks: RoadmapEntry[] = [];
  const malformedBlockIds: string[] = [];
  const problems: string[] = [];
  lines.forEach((text, index) => {
    const line = index + 1;
    if (ROW_START.test(text)) {
      const match = ROW.exec(text);
      if (match?.[1] && match[2] && match[3]) {
        rows.push({ id: match[1], changeId: match[2], status: normalizeStatus(match[3]), line });
      } else {
        problems.push(`${line}: row does not match "| **<ID>** | \`<change-id>\` | … | <status> |"`);
      }
      return;
    }
    const heading = BLOCK_HEADING.exec(text);
    if (!heading?.[1]) return;
    const changeId = BLOCK_CHANGE_ID.exec(lines[index + 1] ?? "")?.[1];
    const status = BLOCK_STATUS.exec(lines[index + 2] ?? "")?.[1];
    if (changeId === undefined || status === undefined) {
      malformedBlockIds.push(heading[1]);
      problems.push(`${line}: ${heading[1]} item block must start with "- **Change ID:**" and "- **Status:**" lines`);
      return;
    }
    blocks.push({ id: heading[1], changeId, status: normalizeStatus(status), line });
  });
  return { rows, blocks, malformedBlockIds, problems };
}

/** Every contract violation in one roadmap file, as `path:line: message`. */
export function findRoadmapProblems(path: string, text: string): string[] {
  const isQueued = path.includes("/roadmaps/");
  const { rows, blocks, malformedBlockIds, problems } = parseRoadmap(text);
  const found = problems.map((problem) => `${path}:${problem}`);
  for (const row of rows) {
    const where = `${path}:${row.line}: ${row.id}`;
    if (!STATUS.test(row.status)) found.push(`${where} status "${row.status}" is not a WORKFLOW §5 status`);
    const keyword = getStatusKeyword(row.status);
    if (isQueued && !QUEUED_STATUSES.has(keyword)) {
      found.push(`${where} is "${keyword}" but a queued roadmap holds only proposed, ready or blocked items`);
    }
    const block = blocks.find((candidate) => candidate.id === row.id);
    if (!block) {
      if (malformedBlockIds.includes(row.id)) continue;
      found.push(`${where} has no "### ${row.id}:" item block`);
      continue;
    }
    if (block.changeId !== row.changeId) {
      found.push(`${path}:${block.line + 1}: ${row.id} block change-id "${block.changeId}" differs from the row "${row.changeId}"`);
    }
    if (block.status !== row.status) {
      found.push(`${path}:${block.line + 2}: ${row.id} block status "${block.status}" differs from the row status "${row.status}"`);
    }
  }
  for (const block of blocks) {
    if (!rows.some((row) => row.id === block.id)) {
      found.push(`${path}:${block.line}: ${block.id} item block has no row in the table`);
    }
  }
  const ids = rows.map((row) => row.id);
  for (const id of new Set(ids.filter((id, index) => ids.indexOf(id) !== index))) {
    found.push(`${path}: ${id} has more than one row`);
  }
  return found;
}

/**
 * Each change-id must live in exactly one folder (WORKFLOW §5.1): `context/changes/<id>`,
 * `context/backlog/roadmap-<slug>/<id>` or `context/archive/<YYYY-MM-DD>-<id>`.
 * @param folders repo-relative folders that hold at least one file
 */
export function findChangeLocationProblems(changeIds: string[], folders: string[]): string[] {
  return changeIds.flatMap((changeId) => {
    const places = folders.filter((folder) => isFolderOfChange(folder, changeId));
    if (places.length === 1) return [];
    if (places.length === 0) {
      return [
        `change-id "${changeId}" has no folder in context/changes/, context/backlog/roadmap-*/ or context/archive/`,
      ];
    }
    return [`change-id "${changeId}" lives in ${places.length} places: ${places.join(", ")}`];
  });
}

function isFolderOfChange(folder: string, changeId: string): boolean {
  if (folder === `context/changes/${changeId}`) return true;
  const [, area, slug, name] = folder.split("/");
  if (area === "backlog") return slug?.startsWith("roadmap-") === true && name === changeId;
  if (area === "archive") return slug === undefined ? false : new RegExp(`^${DATE}-`).test(slug) && slug.slice(11) === changeId;
  return false;
}
