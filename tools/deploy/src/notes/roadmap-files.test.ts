import { describe, expect, it } from "vitest";
import { isArchivedRoadmap, sortArchivedRoadmaps } from "./roadmap-files.js";

describe("archived roadmap files", () => {
  it("recognises the archived roadmap names, with and without a same-day counter", () => {
    for (const path of ["context/foundation/archive/2026-10-03-roadmap.md", "context/foundation/archive/2026-10-03-2-roadmap.md"]) {
      expect(isArchivedRoadmap(path), path).toBe(true);
    }
    for (const path of [
      "context/foundation/archive/notes.md",
      "context/foundation/archive/2026-10-03-prd.md",
      "context/foundation/archive/2026-10-03-roadmap.md.bak",
      "context/foundation/archive/old/2026-10-03-roadmap.md",
      "context/foundation/roadmap.md",
    ]) {
      expect(isArchivedRoadmap(path), path).toBe(false);
    }
  });

  it("orders roadmaps by date, then by the same-day counter", () => {
    const dir = "context/foundation/archive";
    const sorted = sortArchivedRoadmaps([
      `${dir}/2026-10-04-roadmap.md`,
      `${dir}/2026-10-03-10-roadmap.md`,
      `${dir}/2026-10-03-2-roadmap.md`,
      `${dir}/2026-10-03-roadmap.md`,
    ]);
    expect(sorted).toEqual([
      `${dir}/2026-10-03-roadmap.md`,
      `${dir}/2026-10-03-2-roadmap.md`,
      `${dir}/2026-10-03-10-roadmap.md`,
      `${dir}/2026-10-04-roadmap.md`,
    ]);
  });
});
