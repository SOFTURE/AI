// @vitest-environment happy-dom
import { mcpAccessMessages, type RevokeTokenFormState } from "@softure-ai/mcp-access";
import { TOKEN_MANAGER_SECTIONS, TokenManager, type TokenManagerProps } from "@softure-ai/mcp-access/ui";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

afterEach(cleanup);

const en = mcpAccessMessages.en;

// Without the optional parts: no API scopes, OAuth off.
const REQUIRED: TokenManagerProps = {
  tools: [{ name: "whoami", description: "Says whose account this is.", accessText: en.tools.read }],
  tokens: [
    {
      id: "7d1f3c1e-2b3a-4c5d-8e9f-0a1b2c3d4e5f",
      name: "Laptop",
      scopeText: en.list.readOnly,
      statusText: en.list.active,
      isExpired: false,
      details: ["Created September 15, 2026"],
    },
  ],
  allowWrites: false,
  maxTokens: 20,
  issueAction: () => Promise.resolve({ status: "idle" }),
  revokeAction: () => Promise.resolve({ status: "ok" } as RevokeTokenFormState),
  messages: en,
};

const FULL: TokenManagerProps = {
  ...REQUIRED,
  grants: [{ id: "22222222-3333-4444-8555-666666666666", clientName: "Claude", scopeText: en.list.readWrite, details: [en.list.neverUsed] }],
  revokeGrantAction: () => Promise.resolve({ status: "ok" }),
  apiScopes: [{ name: "recipes:read", description: "Reads your recipes.", accessText: en.apiScopes.read, isOffered: true }],
};

const HEADINGS = {
  tools: [en.tools.title],
  issue: [en.issue.title],
  api: [en.apiScopes.title, en.apiIssue.title],
  tokens: [en.list.title],
  grants: [en.grants.title],
} as const;

function getShownHeadings(): string[] {
  return screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent ?? "");
}

describe("TokenManager sections", () => {
  it("shows every section in the page order when none is named", () => {
    render(<TokenManager {...FULL} />);
    expect(getShownHeadings()).toEqual([en.tools.title, en.issue.title, en.apiScopes.title, en.apiIssue.title, en.list.title, en.grants.title]);
    expect(TOKEN_MANAGER_SECTIONS).toEqual(["tools", "issue", "api", "tokens", "grants"]);
  });

  it.each(TOKEN_MANAGER_SECTIONS)("shows only the %s section when it is the one named", (section) => {
    render(<TokenManager {...FULL} sections={[section]} />);
    expect(getShownHeadings()).toEqual(HEADINGS[section]);
  });

  it("keeps the page order whatever the order of the names", () => {
    render(<TokenManager {...FULL} sections={["grants", "tokens", "issue"]} />);
    expect(getShownHeadings()).toEqual([en.issue.title, en.list.title, en.grants.title]);
  });

  it("shows nothing for an empty list", () => {
    render(<TokenManager {...FULL} sections={[]} />);
    expect(screen.queryAllByRole("heading")).toEqual([]);
  });

  it("keeps a named section hidden while its data is missing", () => {
    render(<TokenManager {...REQUIRED} sections={["api", "grants", "tokens"]} />);
    expect(getShownHeadings()).toEqual([en.list.title]);
  });
});
