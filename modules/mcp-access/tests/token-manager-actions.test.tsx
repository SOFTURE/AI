// @vitest-environment happy-dom
import { mcpAccessMessages, type IssueTokenFormState } from "@softure-ai/mcp-access";
import { TokenManager, type IssueTokenAction, type TokenManagerProps } from "@softure-ai/mcp-access/ui";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(cleanup);

const en = mcpAccessMessages.en;
const ACTIONS_CLASSES = "sft:flex sft:flex-wrap sft:items-center sft:gap-2";
const TOKEN = `sftmcp_${"C".repeat(43)}`;
const API_TOKEN = `acme_${"D".repeat(43)}`;

const ISSUED: IssueTokenFormState = {
  status: "ok",
  issued: {
    id: "21111111-2222-4333-8444-555555555555",
    name: "Desktop",
    canWrite: false,
    expiresText: "Works until December 14, 2026.",
    expiresAt: "2026-12-14T12:00:00.000Z",
    setup: {
      serverName: "acme",
      endpointUrl: "http://localhost:3000/api/mcp",
      claudeCodeCommand: "claude mcp add acme",
      assistantPrompt: "Connect to my acme account over MCP.",
      claudeCodeLink: "claude-cli://open?q=Connect",
      jsonConfig: `{"mcpServers":{}}`,
      desktopConfig: `{"mcpServers":{"acme":{}}}`,
      authorizationHeader: `Bearer ${TOKEN}`,
    },
  },
};

const API_ISSUED: IssueTokenFormState = {
  status: "api-ok",
  issued: {
    id: "54444444-2222-4333-8444-555555555555",
    name: "Shortcut",
    scopes: ["recipes:read"],
    expiresText: "Works until December 14, 2026.",
    expiresAt: "2026-12-14T12:00:00.000Z",
    token: API_TOKEN,
    authorizationHeader: `Bearer ${API_TOKEN}`,
    examples: [],
  },
};

const API_SCOPES = [{ name: "recipes:read", description: "Reads your recipes.", accessText: en.apiScopes.read, isOffered: true }];

function renderManager(props: Partial<TokenManagerProps> = {}) {
  render(
    <TokenManager
      tools={[]}
      tokens={[]}
      allowWrites={false}
      maxTokens={20}
      issueAction={vi.fn<IssueTokenAction>(() => Promise.resolve(ISSUED))}
      revokeAction={vi.fn(() => Promise.resolve({ status: "ok" as const }))}
      messages={en}
      {...props}
    />,
  );
}

async function click(element: HTMLElement): Promise<void> {
  await act(async () => {
    fireEvent.click(element);
    await Promise.resolve();
  });
}

/** The class of the row the element sits in: its parent. */
function getRowClass(element: HTMLElement): string {
  return element.parentElement?.className ?? "";
}

describe("TokenManager buttons keep their own width", () => {
  it("puts the token form's submit button alone in an actions row", () => {
    renderManager({ sections: ["issue"] });
    const button = screen.getByRole("button", { name: en.issue.submit });
    expect(getRowClass(button)).toBe(ACTIONS_CLASSES);
    expect(button.parentElement?.children).toHaveLength(1);
  });

  it("puts the issued panel's Claude Code link and Done button in actions rows", async () => {
    renderManager({ sections: ["issue"] });
    fireEvent.change(screen.getByRole("textbox", { name: en.issue.name }), { target: { value: "Desktop" } });
    await click(screen.getByRole("button", { name: en.issue.submit }));
    expect(getRowClass(screen.getByRole("link", { name: en.issued.openClaudeCode }))).toBe(ACTIONS_CLASSES);
    expect(getRowClass(screen.getByRole("button", { name: en.issued.done }))).toBe(ACTIONS_CLASSES);
  });

  it("puts the API form's submit button and the API panel's Done button in actions rows", async () => {
    renderManager({
      sections: ["api"],
      apiScopes: API_SCOPES,
      issueAction: vi.fn<IssueTokenAction>(() => Promise.resolve(API_ISSUED)),
    });
    const submit = screen.getByRole("button", { name: en.apiIssue.submit });
    expect(getRowClass(submit)).toBe(ACTIONS_CLASSES);
    fireEvent.change(screen.getByRole("textbox", { name: en.apiIssue.name }), { target: { value: "Shortcut" } });
    await click(submit);
    expect(getRowClass(screen.getByRole("button", { name: en.issued.done }))).toBe(ACTIONS_CLASSES);
  });

  it("lets the app restyle the actions row through classNames", () => {
    renderManager({ sections: ["issue"], classNames: { actions: "app-actions" } });
    expect(getRowClass(screen.getByRole("button", { name: en.issue.submit }))).toContain("app-actions");
  });

  it("leaves the actions row without classes when unstyled", () => {
    renderManager({ sections: ["issue"], unstyled: true });
    expect(getRowClass(screen.getByRole("button", { name: en.issue.submit }))).toBe("");
  });
});
