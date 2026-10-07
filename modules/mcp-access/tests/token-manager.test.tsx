// @vitest-environment happy-dom
import { mcpAccessMessages, type IssueTokenFormState, type RevokeTokenFormState } from "@softure-ai/mcp-access";
import {
  ConsentError,
  ConsentForm,
  TokenManager,
  type IssueTokenAction,
  type RevokeGrantAction,
  type RevokeTokenAction,
  type TokenManagerProps,
  type TokenManagerRow,
} from "@softure-ai/mcp-access/ui";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(cleanup);

const en = mcpAccessMessages.en;
const TOKEN = `sftmcp_${"A".repeat(43)}`;

const LAPTOP: TokenManagerRow = {
  id: "7d1f3c1e-2b3a-4c5d-8e9f-0a1b2c3d4e5f",
  name: "Laptop",
  scopeText: en.list.readOnly,
  statusText: en.list.active,
  isExpired: false,
  details: ["Created September 15, 2026", "Valid until December 14, 2026", en.list.neverUsed],
};

const ISSUED: IssueTokenFormState = {
  status: "ok",
  issued: {
    id: "11111111-2222-4333-8444-555555555555",
    name: "Desktop",
    canWrite: false,
    expiresText: "Works until December 14, 2026.",
    setup: {
      serverName: "acme",
      endpointUrl: "http://localhost:3000/api/mcp",
      claudeCodeCommand: `claude mcp add --transport http --scope user acme http://localhost:3000/api/mcp --header "Authorization: Bearer ${TOKEN}"`,
      assistantPrompt: "Connect to my acme account over MCP.",
      claudeCodeLink: "claude-cli://open?q=Connect",
      jsonConfig: `{"mcpServers":{}}`,
      desktopConfig: `{"mcpServers":{"acme":{}}}`,
      authorizationHeader: `Bearer ${TOKEN}`,
    },
  },
};

function renderManager(props: Partial<TokenManagerProps> = {}) {
  const issueAction = vi.fn<IssueTokenAction>(() => Promise.resolve(ISSUED));
  const revokeAction = vi.fn<RevokeTokenAction>(() => Promise.resolve({ status: "ok" } as RevokeTokenFormState));
  render(
    <TokenManager
      tools={[
        { name: "whoami", description: "Says whose account this is.", accessText: en.tools.read },
        { name: "add_note", description: "Adds a note.", accessText: en.tools.writeUnavailable },
      ]}
      tokens={[LAPTOP]}
      allowWrites={false}
      maxTokens={20}
      issueAction={issueAction}
      revokeAction={revokeAction}
      messages={en}
      {...props}
    />,
  );
  return { issueAction, revokeAction };
}

async function submit(button: HTMLElement): Promise<void> {
  await act(async () => {
    fireEvent.click(button);
    await Promise.resolve();
  });
}

describe("TokenManager", () => {
  it("lists the tool catalog with what each tool may do", () => {
    renderManager();
    expect(screen.getByText("whoami")).toBeDefined();
    expect(screen.getByText(en.tools.writeUnavailable)).toBeDefined();
    expect(screen.getByText("Adds a note.")).toBeDefined();
  });

  it("offers write access only when the app allows writes", () => {
    renderManager();
    expect(screen.queryByRole("checkbox", { name: en.issue.canWrite })).toBeNull();
    cleanup();
    renderManager({ allowWrites: true });
    expect(screen.getByRole("checkbox", { name: en.issue.canWrite })).toHaveProperty("checked", false);
  });

  it("shows the issued token's setup once, and hides it for good on Done", async () => {
    const { issueAction } = renderManager();
    fireEvent.change(screen.getByRole("textbox", { name: en.issue.name }), { target: { value: "Desktop" } });
    await submit(screen.getByRole("button", { name: en.issue.submit }));
    expect(issueAction).toHaveBeenCalledTimes(1);
    expect(issueAction.mock.calls[0]?.[1].get("name")).toBe("Desktop");
    expect(screen.getByText("Token created: Desktop")).toBeDefined();
    expect(screen.getByText(ISSUED.status === "ok" ? ISSUED.issued.setup.claudeCodeCommand : "")).toBeDefined();
    expect(screen.getByRole("link", { name: en.issued.openClaudeCode }).getAttribute("href")).toBe("claude-cli://open?q=Connect");
    fireEvent.click(screen.getByRole("button", { name: en.issued.done }));
    expect(screen.queryByText("Token created: Desktop")).toBeNull();
    expect(document.body.textContent).not.toContain(TOKEN);
  });

  it("shows the refusal of the issue action", async () => {
    renderManager({ issueAction: () => Promise.resolve({ status: "error", error: "mcp-access.token_limit_reached" }) });
    fireEvent.change(screen.getByRole("textbox", { name: en.issue.name }), { target: { value: "Desktop" } });
    await submit(screen.getByRole("button", { name: en.issue.submit }));
    expect(screen.getByRole("alert").textContent).toBe(en.errors["mcp-access"].token_limit_reached);
  });

  it("lists the owner's tokens and revokes one by its id", async () => {
    const { revokeAction } = renderManager();
    expect(screen.getByText(`${en.list.active} · ${en.list.readOnly}`)).toBeDefined();
    expect(screen.getByText(LAPTOP.details.join(" · "))).toBeDefined();
    await submit(screen.getByRole("button", { name: `${en.list.revoke}: Laptop` }));
    expect(revokeAction.mock.calls[0]?.[1].get("id")).toBe(LAPTOP.id);
  });

  it("says so when the owner has no tokens and the app no tools", () => {
    renderManager({ tokens: [], tools: [] });
    expect(screen.getByText(en.list.empty)).toBeDefined();
    expect(screen.getByText(en.tools.empty)).toBeDefined();
  });

  describe("connected apps", () => {
    const GRANT = { id: "22222222-3333-4444-8555-666666666666", clientName: "Claude", scopeText: en.list.readWrite, details: ["Connected September 15, 2026", en.list.neverUsed] };

    it("are not shown while OAuth is off", () => {
      renderManager();
      expect(screen.queryByText(en.grants.title)).toBeNull();
    });

    it("are listed and disconnected by the grant's id", async () => {
      const revokeGrantAction = vi.fn<RevokeGrantAction>(() => Promise.resolve({ status: "ok" }));
      renderManager({ grants: [GRANT], revokeGrantAction });
      expect(screen.getByText(en.grants.title)).toBeDefined();
      expect(screen.getByText(GRANT.details.join(" · "))).toBeDefined();
      await submit(screen.getByRole("button", { name: `${en.grants.disconnect}: Claude` }));
      expect(revokeGrantAction.mock.calls[0]?.[1].get("id")).toBe(GRANT.id);
    });

    it("show the refusal of the disconnect action", async () => {
      renderManager({ grants: [GRANT], revokeGrantAction: () => Promise.resolve({ status: "error", error: "mcp-access.grant_not_found" }) });
      await submit(screen.getByRole("button", { name: `${en.grants.disconnect}: Claude` }));
      expect(screen.getByRole("alert").textContent).toBe(en.errors["mcp-access"].grant_not_found);
    });

    it("say so when none is connected", () => {
      renderManager({ grants: [], revokeGrantAction: () => Promise.resolve({ status: "ok" }) });
      expect(screen.getByText(en.grants.empty)).toBeDefined();
    });
  });
});

describe("the consent form", () => {
  const PARAMS = [
    ["client_id", "sftmc_abc"],
    ["state", "s-1"],
  ] as const;

  function renderForm(isWriteOffered: boolean) {
    const { container } = render(
      <ConsentForm action="/api/oauth/authorize" params={PARAMS} clientName="Claude" redirectTarget="claude.ai" accountEmail="alice@example.com" isWriteOffered={isWriteOffered} messages={en} />,
    );
    return container;
  }

  it("posts the request's parameters to the decision route with the person's choice", () => {
    const container = renderForm(false);
    const form = container.querySelector("form");
    expect([form?.getAttribute("method"), form?.getAttribute("action")]).toEqual(["post", "/api/oauth/authorize"]);
    const hidden = [...container.querySelectorAll<HTMLInputElement>('input[type="hidden"]')].map((input) => [input.name, input.value]);
    expect(hidden).toEqual(PARAMS.map(([name, value]) => [name, value]));
    const allow = screen.getByRole("button", { name: en.consent.allow });
    expect([allow.getAttribute("name"), allow.getAttribute("value")]).toEqual(["decision", "allow"]);
    expect(screen.getByRole("button", { name: en.consent.deny }).getAttribute("value")).toBe("deny");
  });

  it("names the app, where it returns and the account", () => {
    renderForm(false);
    expect(screen.getByText("alice@example.com")).toBeDefined();
    expect(screen.getByText("(returns to claude.ai)")).toBeDefined();
    expect(screen.getByText(en.consent.readAccess)).toBeDefined();
  });

  it("offers the change checkbox only when writes are on offer", () => {
    renderForm(false);
    expect(screen.queryByRole("checkbox", { name: en.consent.allowWrite })).toBeNull();
    cleanup();
    renderForm(true);
    expect(screen.getByRole("checkbox", { name: en.consent.allowWrite })).toBeDefined();
  });

  it("shows an error with a link back to the client only when one is given", () => {
    render(<ConsentError message={en.consent.unknownClient} messages={en} />);
    expect(screen.getByText(en.consent.nothingGranted)).toBeDefined();
    expect(screen.queryByRole("link")).toBeNull();
    cleanup();
    render(<ConsentError message={en.consent.invalidRequest} backLocation="https://claude.ai/cb?error=invalid_request" backTarget="claude.ai" messages={en} />);
    expect(screen.getByRole("link", { name: "Back to the app (claude.ai)" }).getAttribute("href")).toBe("https://claude.ai/cb?error=invalid_request");
  });
});
