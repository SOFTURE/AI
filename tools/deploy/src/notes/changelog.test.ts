import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { listChangelogRoadmaps, readChangelog, selectChangelogItems } from "./changelog.js";

const TABLE = [
  "# Roadmap",
  "",
  "## At a glance",
  "",
  "| ID | Change | Outcome | Status |",
  "| --- | --- | --- | --- |",
  "| **AB-1** | `ab-login` | Login | done |",
  "| **AB-2** | `ab-reset` | Reset | done_code |",
  "| **AB-3** | `ab-mail` | Mail | in_progress |",
  "| **AB-4** | `ab-old` | Old | done kodowo |",
  "",
  "## Items",
  "",
  "| **AB-9** | x | y | done |",
].join("\n");

let dir: string;

function write(path: string, text: string): void {
  mkdirSync(dirname(join(dir, path)), { recursive: true });
  writeFileSync(join(dir, path), text);
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "softure-deploy-changelog-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("selectChangelogItems", () => {
  it("keeps the done and done_code rows of the At a glance table, ids and change ids only", () => {
    expect(selectChangelogItems(TABLE)).toEqual([
      { id: "AB-1", changeId: "ab-login", status: "done" },
      { id: "AB-2", changeId: "ab-reset", status: "done_code" },
      { id: "AB-4", changeId: "ab-old", status: "done_code" },
    ]);
  });

  it("answers no items for a roadmap without the table", () => {
    expect(selectChangelogItems("# Roadmap\n")).toEqual([]);
  });
});

describe("listChangelogRoadmaps", () => {
  it("takes the open roadmap first, then the archived ones newest first, up to the limit", () => {
    write("context/foundation/roadmap.md", TABLE);
    write("context/foundation/archive/2026-09-01-roadmap.md", TABLE);
    write("context/foundation/archive/2026-10-01-roadmap.md", TABLE);
    write("context/foundation/archive/2026-10-01-2-roadmap.md", TABLE);
    write("context/foundation/archive/notes.md", "not a roadmap");
    expect(listChangelogRoadmaps(dir, 3)).toEqual([
      "context/foundation/roadmap.md",
      "context/foundation/archive/2026-10-01-2-roadmap.md",
      "context/foundation/archive/2026-10-01-roadmap.md",
    ]);
  });

  it("answers no roadmaps in a project without any", () => {
    expect(listChangelogRoadmaps(dir, 2)).toEqual([]);
  });
});

describe("readChangelog", () => {
  it("answers each roadmap with its finished items", () => {
    write("context/foundation/archive/2026-10-01-roadmap.md", TABLE);
    expect(readChangelog(dir)).toEqual([
      { roadmap: "context/foundation/archive/2026-10-01-roadmap.md", items: selectChangelogItems(TABLE) },
    ]);
  });
});
