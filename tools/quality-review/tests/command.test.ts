import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runCommand, type CommandContext } from "../src/cli/command.js";
import { renderReport } from "../src/report.js";
import type { QueryFunction } from "../src/review.js";
import { SOURCE, makeAgentFinding, makeRepo, toBlock } from "./fixtures.js";

let repo: { root: string; cleanup: () => void };
let out: string;
let err: string;

function makeContext(env: NodeJS.ProcessEnv, query?: QueryFunction): CommandContext {
  return {
    cwd: repo.root,
    env,
    write: (text) => {
      out += text;
    },
    writeError: (text) => {
      err += text;
    },
    loadQuery: () => (query === undefined ? Promise.reject(new Error("no SDK in tests")) : Promise.resolve(query)),
  };
}

const QUERY: QueryFunction = () =>
  (async function* () {
    await Promise.resolve();
    yield { type: "assistant", message: { content: [{ type: "text", text: toBlock(makeAgentFinding()) }] } };
    yield { type: "result", subtype: "success", is_error: false, total_cost_usd: 1.25, modelUsage: {} };
  })();

beforeEach(() => {
  repo = makeRepo({ "src/actions.ts": SOURCE });
  out = "";
  err = "";
});

afterEach(() => {
  repo.cleanup();
});

describe("softure-quality-review run", () => {
  it("writes the report and prints a summary", async () => {
    const code = await runCommand(["run", "--commit", "abc123", "--max-budget-usd", "5"], makeContext({ ANTHROPIC_API_KEY: "k" }, QUERY));
    expect(code).toBe(0);
    expect(out).toBe(`Report written to ${join(repo.root, "QUALITY-REPORT.md")}: 1 findings, status complete, 1.2500 USD of 5.00 USD, model claude-opus-5-5\n`);
    expect(readFileSync(join(repo.root, "QUALITY-REPORT.md"), "utf8")).toContain("| Commit | `abc123` |");
  });

  it("refuses to start without ANTHROPIC_API_KEY or with a budget that is not a positive number", async () => {
    expect(await runCommand(["run"], makeContext({}, QUERY))).toBe(2);
    expect(err).toContain("ANTHROPIC_API_KEY is not set");
    err = "";
    expect(await runCommand(["run", "--max-budget-usd", "ten"], makeContext({ ANTHROPIC_API_KEY: "k" }, QUERY))).toBe(2);
    expect(err).toBe('--max-budget-usd must be a number above 0, not "ten"\n');
  });

  it("fails with the reason when the Agent SDK cannot be loaded", async () => {
    expect(await runCommand(["run"], makeContext({ ANTHROPIC_API_KEY: "k" }))).toBe(1);
    expect(err).toBe("no SDK in tests\n");
  });
});

describe("softure-quality-review check", () => {
  it("accepts a valid report", async () => {
    writeFileSync(
      join(repo.root, "QUALITY-REPORT.md"),
      renderReport({
        header: { date: "2026-11-09T10:00:00Z", commit: "abc", model: "m", costUsd: 1, budgetUsd: 10, tokens: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0 }, status: "complete", ignored: 0 },
        findings: [],
      }),
    );
    expect(await runCommand(["check"], makeContext({}))).toBe(0);
    expect(out).toContain("is a valid report: 0 findings, status complete");
  });

  it("lists what is wrong with an invalid report, and fails on a missing file", async () => {
    writeFileSync(join(repo.root, "bad.md"), "# Quality report\n");
    expect(await runCommand(["check", "bad.md"], makeContext({}))).toBe(1);
    expect(err).toContain("does not follow the report format:\n- the format marker");
    expect(await runCommand(["check", "none.md"], makeContext({}))).toBe(1);
  });
});

describe("usage", () => {
  it("prints the usage for no command and fails for an unknown one", async () => {
    expect(await runCommand([], makeContext({}))).toBe(0);
    expect(await runCommand(["publish"], makeContext({}))).toBe(2);
    expect(err).toContain("softure-quality-review check [<report>]");
  });
});
