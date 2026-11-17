import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ReviewAgentOptions } from "../src/agent.js";
import { SECURITY_SCENARIOS } from "../src/coverage.js";
import { parseReport } from "../src/report.js";
import { MAX_COVERAGE_FOLLOW_UPS, buildCoverageFollowUp, runReview, type QueryFunction } from "../src/review.js";
import { SOURCE, makeAgentFinding, makeRepo, toBlock } from "./fixtures.js";

let repo: ReturnType<typeof makeRepo>;

beforeEach(() => {
  repo = makeRepo({ "AGENTS.md": "# Rules\n", "src/session.ts": SOURCE, "src/oauth.ts": SOURCE, "src/unread.ts": SOURCE });
});

afterEach(() => {
  repo.cleanup();
});

const ENV = { ANTHROPIC_API_KEY: "k" };

function read(path: string): unknown {
  return { type: "tool_use", id: "t", name: "Read", input: { file_path: path } };
}

function assistant(...content: unknown[]): unknown {
  return { type: "assistant", message: { content } };
}

function text(value: string): unknown {
  return { type: "text", text: value };
}

function coverage(scenario: string, status: string, files: string[] = []): string {
  return `<coverage>${JSON.stringify({ scenario, status, files, note: `${scenario} note` })}</coverage>`;
}

function result(subtype: string, cost: number, turns: number): unknown {
  return { type: "result", subtype, is_error: subtype !== "success", total_cost_usd: cost, num_turns: turns, modelUsage: {} };
}

interface StreamingRun {
  query: QueryFunction;
  /** The user turns the agent received, in order. */
  turns: string[];
  options: ReviewAgentOptions[];
}

/** A fake agent that answers each user turn of the prompt stream with the next scripted batch of messages. */
function fakeStreamingQuery(script: unknown[][]): StreamingRun {
  const turns: string[] = [];
  const options: ReviewAgentOptions[] = [];
  return {
    turns,
    options,
    query: (params) => {
      options.push(params.options);
      const prompt = params.prompt;
      if (typeof prompt === "string") throw new Error("a security run must stream its prompt");
      return (async function* () {
        let index = 0;
        for await (const message of prompt) {
          turns.push(message.message.content);
          for (const reply of script[index] ?? [result("success", 0, 1)]) yield reply;
          index++;
        }
      })();
    },
  };
}

const ALL_BUT_TWO = SECURITY_SCENARIOS.filter((scenario) => scenario !== "csrf" && scenario !== "runtime-hardening").map((scenario) =>
  coverage(scenario, "no-surface"),
);

describe("a security run's coverage", () => {
  it("asks once for the scenarios it left out, in the same session, and reports the second turn's coverage", async () => {
    const run = fakeStreamingQuery([
      [
        assistant(read(join(repo.root, "src/session.ts")), read("src/oauth.ts")),
        assistant(text([coverage("auth-session", "traced", ["src/session.ts"]), ...ALL_BUT_TWO.slice(1)].join("\n"))),
        result("success", 0.4, 12),
      ],
      [
        assistant(read("src/oauth.ts")),
        assistant(text(`${toBlock(makeAgentFinding({ rule: "csrf", file: "src/oauth.ts", symbol: "consent" }))}\n${coverage("csrf", "traced", ["src/oauth.ts"])}\n${coverage("runtime-hardening", "no-surface")}`)),
        result("success", 1.1, 9),
      ],
    ]);
    const outcome = await runReview({ repo: repo.root, commit: "abc", query: run.query, env: ENV, focus: "security" });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(run.turns).toHaveLength(2);
    expect(run.turns[0]).toContain("Emit a <coverage> block for every threat scenario");
    expect(run.turns[1]).toBe(buildCoverageFollowUp(["csrf", "runtime-hardening"]));
    expect(outcome.notes).toContain("coverage follow-up 1: csrf, runtime-hardening");
    const { header } = outcome.report;
    expect(header.costUsd).toBe(1.1);
    expect(header.turns).toBe(21);
    expect(header.filesRead).toBe(2);
    expect(header.coverage?.every((entry) => entry.status !== "not-covered")).toBe(true);
    expect(header.coverage?.find((entry) => entry.scenario === "auth-session")?.files).toEqual(["src/session.ts"]);
    expect(outcome.report.findings.map((finding) => finding.rule)).toEqual(["csrf"]);
    const markdown = readFileSync(outcome.path, "utf8");
    expect(markdown).toContain("| Turns | 21 |\n| Files read | 2 |");
    expect(markdown).toContain("| csrf | traced | `src/oauth.ts` | csrf note |");
    expect(markdown).not.toContain("were not covered");
    expect(parseReport(markdown).ok).toBe(true);
  });

  it("stops asking after the follow-up limit and reports what is still missing as not covered", async () => {
    const run = fakeStreamingQuery([[assistant(text("Review complete: 0 findings.")), result("success", 0.2, 3)]]);
    const outcome = await runReview({ repo: repo.root, commit: "abc", query: run.query, env: ENV, focus: "security" });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(run.turns).toHaveLength(1 + MAX_COVERAGE_FOLLOW_UPS);
    expect(outcome.report.header.status).toBe("complete");
    expect(outcome.report.header.coverage?.map((entry) => entry.status)).toEqual(SECURITY_SCENARIOS.map(() => "not-covered"));
    expect(readFileSync(outcome.path, "utf8")).toContain("> 10 of 10 threat scenarios were not covered");
  });

  it("does not count a traced scenario whose files the run never read", async () => {
    const run = fakeStreamingQuery([
      [assistant(text([coverage("auth-session", "traced", ["src/unread.ts"]), ...ALL_BUT_TWO.slice(1), coverage("csrf", "no-surface"), coverage("runtime-hardening", "no-surface")].join("\n"))), result("success", 0.2, 2)],
      [assistant(read("src/unread.ts"), text(coverage("auth-session", "traced", ["src/unread.ts"]))), result("success", 0.5, 4)],
    ]);
    const outcome = await runReview({ repo: repo.root, commit: "abc", query: run.query, env: ENV, focus: "security" });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(run.turns[1]).toBe(buildCoverageFollowUp(["auth-session"]));
    expect(outcome.report.header.coverage?.[0]).toEqual({ scenario: "auth-session", status: "traced", files: ["src/unread.ts"], note: "auth-session note" });
  });

  it("asks nothing after a budget stop and counts no file outside the repository or that does not exist", async () => {
    const run = fakeStreamingQuery([[assistant(read("/etc/passwd"), read("src/missing.ts"), read("src"), read("src/session.ts")), result("error_max_budget_usd", 10, 30)]]);
    const outcome = await runReview({ repo: repo.root, commit: "abc", query: run.query, env: ENV, focus: "security" });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(run.turns).toHaveLength(1);
    expect(outcome.report.header.status).toBe("budget");
    expect(outcome.report.header.filesRead).toBe(1);
  });

  it("closes the prompt stream when the agent fails, so the run ends", async () => {
    const run = fakeStreamingQuery([[assistant(text("x")), { type: "boom" }]]);
    const failing: QueryFunction = (params) => {
      const messages = run.query(params);
      return (async function* () {
        for await (const message of messages) {
          if ((message as { type: string }).type === "boom") throw new Error("connection lost");
          yield message;
        }
      })();
    };
    const outcome = await runReview({ repo: repo.root, commit: "abc", query: failing, env: ENV, focus: "security" });
    expect(outcome).toEqual({ ok: false, error: "The review agent failed: connection lost", costUsd: 0 });
  });

  it("keeps a general run on a string prompt with no coverage, turns or files in its header", async () => {
    const prompts: unknown[] = [];
    const query: QueryFunction = (params) => {
      prompts.push(params.prompt);
      return (async function* () {
        await Promise.resolve();
        yield assistant(read("src/session.ts"), text("Review complete: 0 findings."));
        yield result("success", 0.1, 5);
      })();
    };
    const outcome = await runReview({ repo: repo.root, commit: "abc", query, env: ENV });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(typeof prompts[0]).toBe("string");
    expect(outcome.report.header).not.toHaveProperty("coverage");
    expect(outcome.report.header).not.toHaveProperty("turns");
    expect(outcome.report.header).not.toHaveProperty("filesRead");
  });
});
