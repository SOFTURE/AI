import { describe, expect, it } from "vitest";
import { parseRoadmapItems, selectShippingItems } from "./roadmap-items.js";

const ROADMAP = `# Roadmap: deploy follow-ups

## At a glance

| ID | Change | Outcome | Depends on | Mode | Status |
| --- | --- | --- | --- | --- | --- |
| **DF-1** | \`deploy-parity\` | parity with the app | — | owner | done_code (2026-10-06; waiting: release) |
| **DF-2** | \`deploy-workflow-verify-config\` | verify \\| with config | DP-4 | autonomous | done |
| **DF-3** | \`deploy-workflow-e2e\` | e2e | DF-7 | autonomous | in_progress (plan, since 2026-10-06; worktree) |
| **KL-4** | \`zapis-na-liste\` | the list | KL-3 | **done kodowo** (2026-09-29) |

## Order

| **XX-9** | not this table | — | — | done_code |
`;

describe("roadmap items of a release", () => {
  const items = parseRoadmapItems(ROADMAP);

  it("reads only the At a glance table, without bold and backticks, the status as the last cell", () => {
    expect(items.map((item) => item.id)).toEqual(["DF-1", "DF-2", "DF-3", "KL-4"]);
    expect(items[0]).toEqual({
      id: "DF-1",
      changeId: "deploy-parity",
      outcome: "parity with the app",
      status: "done_code (2026-10-06; waiting: release)",
    });
    expect(items[1]?.outcome).toBe("verify \\| with config");
    expect(items[3]?.status).toBe("done kodowo (2026-09-29)");
  });

  it("ships done_code items (and the older done kodowo), not done or in-progress ones", () => {
    expect(selectShippingItems(items).map((item) => item.id)).toEqual(["DF-1", "KL-4"]);
  });

  it("returns no items for a file without the table", () => {
    expect(parseRoadmapItems("# Roadmap\n\n| **AB-1** | x | y | done_code |\n")).toEqual([]);
    expect(parseRoadmapItems("")).toEqual([]);
  });
});
