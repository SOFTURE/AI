import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ReviewAgentOptions } from "../src/agent.js";
import { parseReport } from "../src/report.js";
import { runReview, type QueryFunction } from "../src/review.js";
import { SOURCE, makeAgentFinding, makeRepo, toBlock } from "./fixtures.js";

let repo: { root: string; cleanup: () => void };

beforeEach(() => {
  repo = makeRepo({ "src/actions.ts": SOURCE, "src/client.ts": SOURCE, "AGENTS.md": "# Rules\n" });
});

afterEach(() => {
  repo.cleanup();
});

interface FakeRun {
  query: QueryFunction;
  calls: { prompt: string; options: ReviewAgentOptions }[];
}

function text(value: string): unknown {
  return { type: "assistant", message: { content: [{ type: "text", text: value }, { type: "tool_use", name: "Read" }] } };
}

function result(subtype: string, extra: Record<string, unknown> = {}): unknown {
  return {
    type: "result",
    subtype,
    is_error: subtype !== "success",
    total_cost_usd: 2.5,
    modelUsage: {
      "claude-opus-5-5": { inputTokens: 100, outputTokens: 50, cacheReadInputTokens: 1000, cacheCreationInputTokens: 200, costUSD: 2.4 },
      "claude-haiku-5-5": { inputTokens: 10, outputTokens: 5, cacheReadInputTokens: 0, cacheCreationInputTokens: 0, costUSD: 0.1 },
    },
    ...extra,
  };
}

function fakeQuery(messages: unknown[], onStart?: () => void): FakeRun {
  const calls: FakeRun["calls"] = [];
  return {
    calls,
    query: (params) => {
      calls.push(params);
      onStart?.();
      return (async function* () {
        for (const message of messages) {
          await Promise.resolve();
          yield message;
        }
      })();
    },
  };
}

const NOW = new Date("2026-11-09T10:00:00.123Z");

describe("runReview", () => {
  it("writes a valid report with the verified findings, the cost, the models and the tokens", async () => {
    const run = fakeQuery([
      { type: "system", subtype: "init", model: "claude-opus-5-5" },
      text(`Checking.\n${toBlock(makeAgentFinding())}`),
      text(toBlock(makeAgentFinding({ category: "errors", rule: "missing-timeout", severity: "warning", file: "src/client.ts", line: 4, symbol: "fetchRates" }))),
      result("success"),
    ]);
    const outcome = await runReview({ repo: repo.root, commit: "abc123", now: NOW, query: run.query, env: { ANTHROPIC_API_KEY: "k" }, prompt: "p" });
    expect(outcome.ok).toBe(true);
    const parsed = parseReport(readFileSync(join(repo.root, "QUALITY-REPORT.md"), "utf8"));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.report.header).toEqual({
      date: "2026-11-09T10:00:00Z",
      commit: "abc123",
      model: "claude-opus-5-5 + claude-haiku-5-5",
      costUsd: 2.5,
      budgetUsd: 10,
      tokens: { input: 110, output: 55, cacheRead: 1000, cacheWrite: 200 },
      status: "complete",
      ignored: 0,
    });
    expect(parsed.report.findings.map((finding) => finding.rule)).toEqual(["missing-authorization", "missing-timeout"]);
  });

  it("starts the agent read-only, with the budget, the model and the commit in its task", async () => {
    const run = fakeQuery([result("success")]);
    await runReview({ repo: repo.root, commit: "abc123", budgetUsd: 4, model: "claude-sonnet-5-5", query: run.query, env: {}, prompt: "p" });
    const call = run.calls[0];
    expect(call?.options.tools).toEqual(["Read", "Glob", "Grep"]);
    expect(call?.options.maxBudgetUsd).toBe(4);
    expect(call?.options.model).toBe("claude-sonnet-5-5");
    expect(call?.options.systemPrompt).toBe("p");
    expect(call?.prompt).toContain("at commit abc123");
    expect(call?.prompt).toContain("Do not read QUALITY-REPORT.md");
  });

  it("replaces the previous report entirely: it is gone before the agent starts and nothing of it is kept", async () => {
    const reportPath = join(repo.root, "QUALITY-REPORT.md");
    writeFileSync(reportPath, "# Quality report\n\n### QR-deadbeef: an old finding\n");
    let existedAtStart = true;
    const run = fakeQuery([result("success")], () => {
      existedAtStart = existsSync(reportPath);
    });
    await runReview({ repo: repo.root, commit: "abc123", query: run.query, env: {}, prompt: "p" });
    expect(existedAtStart).toBe(false);
    const report = readFileSync(reportPath, "utf8");
    expect(report).not.toContain("QR-deadbeef");
    expect(report).toContain("No findings: the review found nothing to report at this commit.");
  });

  it("keeps the findings verified before a budget stop and marks the report as stopped", async () => {
    const run = fakeQuery([text(toBlock(makeAgentFinding())), result("error_max_budget_usd", { total_cost_usd: 10.04 })]);
    const outcome = await runReview({ repo: repo.root, commit: "abc123", query: run.query, env: {}, prompt: "p" });
    expect(outcome.ok && outcome.report.header.status).toBe("budget");
    expect(outcome.ok && outcome.report.findings).toHaveLength(1);
    const report = readFileSync(join(repo.root, "QUALITY-REPORT.md"), "utf8");
    expect(report).toContain("| Status | stopped at the budget |");
    expect(report).toContain("| Cost | 10.0400 USD of a 10.00 USD budget |");
  });

  it("marks a run stopped at the turn cap", async () => {
    const run = fakeQuery([result("error_max_turns")]);
    const outcome = await runReview({ repo: repo.root, commit: "abc123", query: run.query, env: {}, prompt: "p" });
    expect(outcome.ok && outcome.report.header.status).toBe("turns");
  });

  it("drops findings whose location does not exist and those an exception covers, and says so", async () => {
    writeFileSync(join(repo.root, "quality-review.ignore"), "path src/client.ts\nbogus line\n");
    const run = fakeQuery([
      text(toBlock(makeAgentFinding())),
      text(toBlock(makeAgentFinding({ file: "src/missing.ts", symbol: "x" }))),
      text(toBlock(makeAgentFinding({ file: "src/actions.ts", line: 99, symbol: "y" }))),
      text(toBlock(makeAgentFinding({ file: "../outside.ts", symbol: "z" }))),
      text(toBlock(makeAgentFinding({ file: "src/client.ts", symbol: "w" }))),
      text("<finding>{broken</finding>"),
      result("success"),
    ]);
    const outcome = await runReview({ repo: repo.root, commit: "abc123", query: run.query, env: {}, prompt: "p" });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.report.findings.map((finding) => finding.symbol)).toEqual(["deleteProject"]);
    expect(outcome.report.header.ignored).toBe(1);
    expect(outcome.notes).toEqual([
      "ignored exception line (not id, rule or path): quality-review.ignore:2: bogus line",
      "rejected agent block: not JSON: {broken",
      expect.stringMatching(/^dropped finding: QR-[0-9a-f]{8} src\/missing\.ts:3: the file does not exist$/),
      expect.stringMatching(/^dropped finding: QR-[0-9a-f]{8} src\/actions\.ts:99: the file has 10 lines$/),
      expect.stringMatching(/^dropped finding: QR-[0-9a-f]{8} \.\.\/outside\.ts:3: the file (does not exist|is outside the repository)$/),
    ]);
  });

  it("writes nothing when the agent fails, ends without a result or throws", async () => {
    const failed = fakeQuery([text(toBlock(makeAgentFinding())), result("error_during_execution", { errors: ["401 invalid x-api-key"] })]);
    expect(await runReview({ repo: repo.root, commit: "a", query: failed.query, env: {}, prompt: "p" })).toEqual({
      ok: false,
      error: "The review agent ended with error_during_execution: 401 invalid x-api-key",
      costUsd: 2.5,
    });
    const silent = fakeQuery([text("hello")]);
    expect(await runReview({ repo: repo.root, commit: "a", query: silent.query, env: {}, prompt: "p" })).toEqual({
      ok: false,
      error: "The review agent ended without a result",
      costUsd: 0,
    });
    const throwing: QueryFunction = () => {
      throw new Error("spawn failed");
    };
    const thrown = await runReview({ repo: repo.root, commit: "a", query: throwing, env: {}, prompt: "p" });
    expect(thrown).toEqual({ ok: false, error: "The review agent failed: spawn failed", costUsd: 0 });
    expect(existsSync(join(repo.root, "QUALITY-REPORT.md"))).toBe(false);
  });

  it("refuses a budget that is not above 0 before it starts the agent", async () => {
    const run = fakeQuery([result("success")]);
    const outcome = await runReview({ repo: repo.root, commit: "a", budgetUsd: 0, query: run.query, env: {}, prompt: "p" });
    expect(outcome).toEqual({ ok: false, error: "The budget must be above 0 USD, not 0", costUsd: 0 });
    expect(run.calls).toEqual([]);
  });

  it("reads the shared prompt from the package when none is given", async () => {
    const run = fakeQuery([result("success")]);
    await runReview({ repo: repo.root, commit: "a", query: run.query, env: {} });
    expect(run.calls[0]?.options.systemPrompt).toContain("Read `AGENTS.md` at the root first");
  });
});
