import { existsSync, realpathSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";

/** The only tools the review agent has: it reads, it never writes, runs or fetches. */
export const REVIEW_TOOLS = ["Read", "Glob", "Grep"] as const;

/**
 * Tools named here are removed from the agent even if a later SDK adds them to a default set. The guard is
 * `REVIEW_TOOLS`; this list is the second line.
 */
export const DENIED_TOOLS = [
  "Bash",
  "BashOutput",
  "KillShell",
  "Edit",
  "MultiEdit",
  "Write",
  "NotebookEdit",
  "WebFetch",
  "WebSearch",
  "Task",
  "Agent",
  "Skill",
  "SlashCommand",
  "TodoWrite",
  "ExitPlanMode",
  "ListMcpResources",
  "ReadMcpResource",
] as const;

/** The model a run uses unless the caller names another. */
export const DEFAULT_MODEL = "claude-opus-5-5";
/** The hard cost cap of one run in USD unless the caller sets another. */
export const DEFAULT_BUDGET_USD = 10;
/** The turn cap of one run: a backstop against a loop, far above what a review of a large repository takes. */
export const DEFAULT_MAX_TURNS = 400;

type PermissionDecision = { behavior: "allow"; updatedInput: Record<string, unknown> } | { behavior: "deny"; message: string };

interface PreToolUseOutput {
  hookSpecificOutput?: { hookEventName: "PreToolUse"; permissionDecision: "deny"; permissionDecisionReason: string };
}

/** The subset of the Agent SDK's `Options` this package sets, typed here so the SDK stays an optional peer. */
export interface ReviewAgentOptions {
  cwd: string;
  model: string;
  systemPrompt: string;
  tools: string[];
  allowedTools: string[];
  disallowedTools: string[];
  permissionMode: "default";
  settingSources: never[];
  mcpServers: Record<string, never>;
  strictMcpConfig: true;
  maxBudgetUsd: number;
  maxTurns: number;
  env: Record<string, string | undefined>;
  canUseTool: (toolName: string, input: Record<string, unknown>) => Promise<PermissionDecision>;
  hooks: {
    PreToolUse: { hooks: ((input: unknown) => Promise<PreToolUseOutput>)[] }[];
  };
}

/** The path arguments of the read tools; any of them must stay inside the repository. */
const PATH_KEYS: Record<(typeof REVIEW_TOOLS)[number], string[]> = {
  Read: ["file_path"],
  Glob: ["path", "pattern"],
  Grep: ["path", "glob"],
};

function isInside(root: string, path: string): boolean {
  const target = resolve(root, path);
  const real = existsSync(target) ? realpathSync(target) : target;
  const inside = relative(root, real);
  return inside === "" || (!inside.startsWith("..") && !isAbsolute(inside));
}

/**
 * Why a tool call is refused, or null when it may run: only the three read tools, and only on paths inside the
 * repository (a symlink is followed first), so the agent cannot read the runner's environment or files outside the
 * checkout and copy them into a public pull request.
 */
export function getToolRefusal(repo: string, toolName: string, input: Record<string, unknown>): string | null {
  if (!(REVIEW_TOOLS as readonly string[]).includes(toolName)) {
    return `${toolName} is not available: the quality review is read-only (Read, Glob, Grep)`;
  }
  const root = realpathSync(repo);
  for (const key of PATH_KEYS[toolName as (typeof REVIEW_TOOLS)[number]]) {
    const value = input[key];
    if (typeof value !== "string" || value === "") continue;
    const path = key === "pattern" || key === "glob" ? value.replace(/[*?[{].*$/, "") || "." : value;
    if (!isInside(root, path)) return `${toolName} may only read inside the repository, not ${value}`;
  }
  return null;
}

function readToolCall(input: unknown): { toolName: string; toolInput: Record<string, unknown> } | null {
  if (typeof input !== "object" || input === null) return null;
  const record = input as Record<string, unknown>;
  const toolInput = record.tool_input;
  if (typeof record.tool_name !== "string") return null;
  return {
    toolName: record.tool_name,
    toolInput: typeof toolInput === "object" && toolInput !== null ? (toolInput as Record<string, unknown>) : {},
  };
}

export interface AgentOptionsInput {
  repo: string;
  model: string;
  budgetUsd: number;
  maxTurns: number;
  systemPrompt: string;
  /** The process environment; only what the agent needs is passed on. */
  env: NodeJS.ProcessEnv;
}

/**
 * The read-only agent: three tools and nothing else, three guards that refuse anything beyond them (the tool list,
 * the permission callback and a PreToolUse hook that runs for every call), no settings, hooks or MCP servers from the
 * reviewed repository, a hard cost cap, and an environment with the API key and nothing else of the runner's.
 */
export function buildAgentOptions(input: AgentOptionsInput): ReviewAgentOptions {
  const { repo } = input;
  return {
    cwd: repo,
    model: input.model,
    systemPrompt: input.systemPrompt,
    tools: [...REVIEW_TOOLS],
    // Nothing is pre-approved: reads inside the working directory run without a prompt, and every other call reaches
    // canUseTool, which refuses it.
    allowedTools: [],
    disallowedTools: [...DENIED_TOOLS],
    permissionMode: "default",
    settingSources: [],
    mcpServers: {},
    strictMcpConfig: true,
    maxBudgetUsd: input.budgetUsd,
    maxTurns: input.maxTurns,
    env: {
      PATH: input.env.PATH,
      HOME: input.env.HOME,
      ANTHROPIC_API_KEY: input.env.ANTHROPIC_API_KEY,
      CLAUDE_AGENT_SDK_CLIENT_APP: "softure-quality-review",
      CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
    },
    canUseTool: (toolName, toolInput) => {
      const refusal = getToolRefusal(repo, toolName, toolInput);
      return Promise.resolve(refusal === null ? { behavior: "allow", updatedInput: toolInput } : { behavior: "deny", message: refusal });
    },
    hooks: {
      PreToolUse: [
        {
          hooks: [
            (hookInput) => {
              const call = readToolCall(hookInput);
              const refusal = call === null ? "the tool call could not be read" : getToolRefusal(repo, call.toolName, call.toolInput);
              return Promise.resolve(
                refusal === null
                  ? {}
                  : { hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: refusal } },
              );
            },
          ],
        },
      ],
    },
  };
}
