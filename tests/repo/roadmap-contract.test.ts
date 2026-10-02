import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { findChangeLocationProblems, findRoadmapProblems, parseRoadmap } from "./roadmap-contract.js";
import { listRepoFiles, REPO_ROOT } from "./repo-files.js";

function buildRoadmap(rowStatus: string, blockStatus: string = rowStatus.replaceAll("**", "")): string {
  return [
    "# Roadmap demo",
    "",
    "| ID | Change | Outcome | Depends on | Mode | Status |",
    "| --- | --- | --- | --- | --- | --- |",
    `| **FD-1** | \`monorepo-tooling\` | gates, a | b | — | autonomous | ${rowStatus} |`,
    "",
    "## Items",
    "",
    "### FD-1: Monorepo tooling",
    "- **Change ID:** `monorepo-tooling`",
    `- **Status:** ${blockStatus}`,
    "- **Outcome:** gates",
    "",
  ].join("\n");
}

describe("parseRoadmap", () => {
  it("reads the row and the item block, with the last cell as the status", () => {
    const parsed = parseRoadmap(buildRoadmap("ready"));
    expect(parsed.rows).toEqual([{ id: "FD-1", changeId: "monorepo-tooling", status: "ready", line: 5 }]);
    expect(parsed.blocks).toEqual([{ id: "FD-1", changeId: "monorepo-tooling", status: "ready", line: 9 }]);
  });
});

describe("findRoadmapProblems", () => {
  const MAIN = "context/foundation/roadmap.md";
  const QUEUED = "context/foundation/roadmaps/roadmap-demo.md";

  it("accepts every status of the WORKFLOW §5 vocabulary", () => {
    const statuses = [
      "proposed",
      "ready",
      "done",
      "blocked (waits for the owner's npm account)",
      "**in_progress** (research, since 2026-10-02; cloud session, branch `x` — do not take in another session)",
      "in_progress (implement 2/5, since 2026-10-02; worktree `../AI-x`, branch `x`)",
      "**ready_to_merge** (since 2026-10-03; branch `x`)",
      "done_code (2026-10-04; waiting: first tagged release)",
    ];
    for (const status of statuses) expect(findRoadmapProblems(MAIN, buildRoadmap(status)), status).toEqual([]);
  });

  it("rejects a status outside the vocabulary", () => {
    expect(findRoadmapProblems(MAIN, buildRoadmap("in progress"))).toEqual([
      `${MAIN}:5: FD-1 status "in progress" is not a WORKFLOW §5 status`,
    ]);
  });

  it("rejects an in_progress status with an unknown stage", () => {
    const problems = findRoadmapProblems(MAIN, buildRoadmap("in_progress (coding, since 2026-10-02; branch `x`)"));
    expect(problems).toHaveLength(1);
  });

  it("treats the bold row status and the plain block status as equal", () => {
    const row = "**in_progress** (research, since 2026-10-02; branch `x`)";
    expect(findRoadmapProblems(MAIN, buildRoadmap(row, "in_progress (research, since 2026-10-02; branch `x`)"))).toEqual(
      [],
    );
  });

  it("rejects a block status that differs from the row", () => {
    expect(findRoadmapProblems(MAIN, buildRoadmap("ready", "done"))).toEqual([
      `${MAIN}:11: FD-1 block status "done" differs from the row status "ready"`,
    ]);
  });

  it("rejects an item without a block and a block without a row", () => {
    const withoutBlock = buildRoadmap("ready").replace("### FD-1:", "### FD-9:");
    expect(findRoadmapProblems(MAIN, withoutBlock)).toEqual([
      `${MAIN}:5: FD-1 has no "### FD-1:" item block`,
      `${MAIN}:9: FD-9 item block has no row in the table`,
    ]);
  });

  it("rejects a block whose Change ID or Status line is not directly under the heading", () => {
    const text = buildRoadmap("ready").replace("- **Change ID:** `monorepo-tooling`\n", "");
    expect(findRoadmapProblems(MAIN, text)).toEqual([
      `${MAIN}:9: FD-1 item block must start with "- **Change ID:**" and "- **Status:**" lines`,
    ]);
  });

  it("rejects a row that does not match the row format", () => {
    const text = buildRoadmap("ready").replace("`monorepo-tooling` |", "monorepo-tooling |");
    expect(findRoadmapProblems(MAIN, text)[0]).toBe(
      `${MAIN}:5: row does not match "| **<ID>** | \`<change-id>\` | … | <status> |"`,
    );
  });

  it("rejects a queued roadmap with an item in flight", () => {
    expect(findRoadmapProblems(QUEUED, buildRoadmap("in_progress (plan, since 2026-10-02; branch `x`)"))).toEqual([
      `${QUEUED}:5: FD-1 is "in_progress" but a queued roadmap holds only proposed, ready or blocked items`,
    ]);
  });
});

describe("findChangeLocationProblems", () => {
  const folders = [
    "context/changes/monorepo-tooling",
    "context/backlog/roadmap-identity/auth-core",
    "context/archive/2026-09-30-old-change",
    "context/changes/twice",
    "context/archive/2026-09-01-twice",
  ];

  it("accepts a change-id that lives in exactly one of changes/, backlog/ or archive/", () => {
    expect(findChangeLocationProblems(["monorepo-tooling", "auth-core", "old-change"], folders)).toEqual([]);
  });

  it("rejects a change-id with no folder and one with two folders", () => {
    expect(findChangeLocationProblems(["missing", "twice"], folders)).toEqual([
      'change-id "missing" has no folder in context/changes/, context/backlog/roadmap-*/ or context/archive/',
      'change-id "twice" lives in 2 places: context/changes/twice, context/archive/2026-09-01-twice',
    ]);
  });

  it("does not match a change-id that is only a suffix of an archived one", () => {
    expect(findChangeLocationProblems(["change"], folders)).toHaveLength(1);
  });
});

describe("the repository roadmaps", () => {
  const roadmapPaths = [
    "context/foundation/roadmap.md",
    ...readdirSync(join(REPO_ROOT, "context/foundation/roadmaps"))
      .filter((name) => /^roadmap-.+\.md$/.test(name))
      .map((name) => `context/foundation/roadmaps/${name}`),
  ];

  it("finds the main roadmap and the queued ones", () => {
    expect(roadmapPaths.length).toBeGreaterThan(1);
  });

  it.each(roadmapPaths)("%s follows the roadmap contract", (path) => {
    expect(findRoadmapProblems(path, readFileSync(join(REPO_ROOT, path), "utf8"))).toEqual([]);
  });

  it("uses every change-id once, and each lives in exactly one folder", () => {
    const changeIds = roadmapPaths.flatMap(
      (path) => parseRoadmap(readFileSync(join(REPO_ROOT, path), "utf8")).rows.map((row) => row.changeId),
    );
    const duplicates = changeIds.filter((id, index) => changeIds.indexOf(id) !== index);
    expect(duplicates).toEqual([]);
    const changeFolders = [
      ...new Set(
        listRepoFiles()
          .map((path) => /^(context\/(?:changes|archive|backlog\/roadmap-[^/]+)\/[^/]+)\//.exec(path)?.[1])
          .filter((folder): folder is string => folder !== undefined),
      ),
    ];
    expect(findChangeLocationProblems(changeIds, changeFolders)).toEqual([]);
  });
});
