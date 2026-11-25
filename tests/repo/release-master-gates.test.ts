import { describe, expect, it } from "vitest";
import { decideGates } from "../../scripts/release/master-gates.mjs";

const SUCCESS = { status: "completed", conclusion: "success" };
const FAILURE = { status: "completed", conclusion: "failure" };
const CANCELLED = { status: "completed", conclusion: "cancelled" };
const IN_PROGRESS = { status: "in_progress", conclusion: null };
const QUEUED = { status: "queued", conclusion: null };

describe("decideGates", () => {
  it("skips the gates when the commit has a successful master run", () => {
    expect(decideGates([SUCCESS])).toBe("passed");
  });

  it("skips the gates when one of several runs succeeded", () => {
    expect(decideGates([CANCELLED, SUCCESS, IN_PROGRESS])).toBe("passed");
  });

  it("waits while a run is in progress or queued", () => {
    expect(decideGates([IN_PROGRESS])).toBe("wait");
    expect(decideGates([CANCELLED, QUEUED])).toBe("wait");
  });

  it("runs the gates when the commit has no master run", () => {
    expect(decideGates([])).toBe("run");
  });

  it("runs the gates when every run failed or was cancelled", () => {
    expect(decideGates([FAILURE])).toBe("run");
    expect(decideGates([CANCELLED])).toBe("run");
    expect(decideGates([FAILURE, CANCELLED])).toBe("run");
  });

  it("does not count a completed run without a conclusion as passed", () => {
    expect(decideGates([{ status: "completed", conclusion: null }])).toBe("run");
  });
});
