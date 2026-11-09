import { mkdirSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DENIED_TOOLS, REVIEW_TOOLS, buildAgentOptions, getToolRefusal, type ReviewAgentOptions } from "../src/agent.js";
import { makeRepo } from "./fixtures.js";

let repo: { root: string; cleanup: () => void };
let options: ReviewAgentOptions;

beforeEach(() => {
  repo = makeRepo({ "src/a.ts": "export const a = 1;\n", "AGENTS.md": "# Rules\n" });
  options = buildAgentOptions({
    repo: repo.root,
    model: "claude-opus-5-5",
    budgetUsd: 10,
    maxTurns: 400,
    systemPrompt: "review",
    env: { PATH: "/usr/bin", HOME: "/home/runner", ANTHROPIC_API_KEY: "sk-test", DATABASE_URL: "postgres://secret", GITHUB_TOKEN: "ghs_x" },
  });
});

afterEach(() => {
  repo.cleanup();
});

async function decide(toolName: string, input: Record<string, unknown>): Promise<string> {
  return (await options.canUseTool(toolName, input)).behavior;
}

async function runHook(toolName: string, input: Record<string, unknown>): Promise<string | undefined> {
  const hook = options.hooks.PreToolUse[0]?.hooks[0];
  const output = await hook?.({ hook_event_name: "PreToolUse", tool_name: toolName, tool_input: input });
  return output?.hookSpecificOutput?.permissionDecision;
}

describe("the review agent's tools (read-only guard)", () => {
  it("are exactly Read, Glob and Grep", () => {
    expect(REVIEW_TOOLS).toEqual(["Read", "Glob", "Grep"]);
    expect(options.tools).toEqual(["Read", "Glob", "Grep"]);
  });

  it("pre-approve nothing, so every call outside the working directory reaches the guard", () => {
    expect(options.allowedTools).toEqual([]);
    expect(options.permissionMode).toBe("default");
  });

  it("deny every tool that writes, runs, fetches or delegates", () => {
    for (const tool of ["Bash", "Edit", "MultiEdit", "Write", "NotebookEdit", "WebFetch", "WebSearch", "Task", "Agent"]) {
      expect(options.disallowedTools).toContain(tool);
    }
    expect(DENIED_TOOLS.filter((tool) => (REVIEW_TOOLS as readonly string[]).includes(tool))).toEqual([]);
  });

  it("load no settings, hooks or MCP servers of the reviewed repository", () => {
    expect(options.settingSources).toEqual([]);
    expect(options.mcpServers).toEqual({});
    expect(options.strictMcpConfig).toBe(true);
  });

  it("pass the agent the API key and nothing else of the runner's environment", () => {
    expect(options.env).toEqual({
      PATH: "/usr/bin",
      HOME: "/home/runner",
      ANTHROPIC_API_KEY: "sk-test",
      CLAUDE_AGENT_SDK_CLIENT_APP: "softure-quality-review",
      CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
    });
  });

  it("carry the budget, the turn cap, the model and the prompt", () => {
    expect(options).toMatchObject({ maxBudgetUsd: 10, maxTurns: 400, model: "claude-opus-5-5", systemPrompt: "review", cwd: repo.root });
  });
});

describe.each([
  ["the permission callback", (tool: string, input: Record<string, unknown>) => decide(tool, input), "allow", "deny"],
  ["the PreToolUse hook", (tool: string, input: Record<string, unknown>) => runHook(tool, input), undefined, "deny"],
])("%s", (_name, check, allowed, denied) => {
  it("lets the read tools read inside the repository", async () => {
    expect(await check("Read", { file_path: join(repo.root, "src/a.ts") })).toBe(allowed);
    expect(await check("Read", { file_path: "src/a.ts" })).toBe(allowed);
    expect(await check("Glob", { pattern: "src/**/*.ts" })).toBe(allowed);
    expect(await check("Grep", { pattern: "../secret", path: "src", glob: "*.ts" })).toBe(allowed);
  });

  it("refuses every other tool", async () => {
    for (const tool of ["Bash", "Write", "Edit", "WebFetch", "mcp__server__tool"]) {
      expect(await check(tool, {})).toBe(denied);
    }
  });

  it("refuses paths outside the repository, through .. or a symlink", async () => {
    mkdirSync(join(repo.root, "links"));
    symlinkSync("/etc", join(repo.root, "links/etc"));
    expect(await check("Read", { file_path: "/proc/self/environ" })).toBe(denied);
    expect(await check("Read", { file_path: "../outside.txt" })).toBe(denied);
    expect(await check("Read", { file_path: "links/etc/hostname" })).toBe(denied);
    expect(await check("Glob", { pattern: "/etc/**" })).toBe(denied);
    expect(await check("Glob", { pattern: "*", path: "/home" })).toBe(denied);
    expect(await check("Grep", { pattern: "key", path: "/" })).toBe(denied);
  });
});

describe("getToolRefusal", () => {
  it("says why a call is refused", () => {
    expect(getToolRefusal(repo.root, "Bash", {})).toBe("Bash is not available: the quality review is read-only (Read, Glob, Grep)");
    expect(getToolRefusal(repo.root, "Read", { file_path: "/etc/passwd" })).toBe("Read may only read inside the repository, not /etc/passwd");
    expect(getToolRefusal(repo.root, "Read", { file_path: "src/a.ts" })).toBeNull();
  });
});
