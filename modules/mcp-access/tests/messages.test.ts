import { getTokenErrorMessage, mcpAccessMessages, type TokenFormErrorCode } from "@softure-ai/mcp-access";
import { describe, expect, it } from "vitest";

const CODES: TokenFormErrorCode[] = [
  "mcp-access.name_required",
  "mcp-access.name_too_long",
  "mcp-access.token_limit_reached",
  "mcp-access.token_not_found",
  "auth.unauthenticated",
  "core.database_failed",
  "core.unexpected",
];

describe("mcp-access messages", () => {
  it.each(["en", "pl"] as const)("have copy in %s for every code the page can show", (locale) => {
    for (const code of CODES) {
      const message = getTokenErrorMessage(mcpAccessMessages[locale], code);
      expect(message, code).not.toBe("");
      expect(message === mcpAccessMessages[locale].errors.core.unexpected, code).toBe(code === "core.unexpected" || code === "core.database_failed");
    }
  });

  it("fall back to the generic failure for a code they do not know", () => {
    // @ts-expect-error: a code from a newer server than the dictionary.
    expect(getTokenErrorMessage(mcpAccessMessages.en, "mcp-access.something_new")).toBe(mcpAccessMessages.en.errors.core.unexpected);
    // @ts-expect-error: an inherited property is not a message.
    expect(getTokenErrorMessage(mcpAccessMessages.en, "auth.toString")).toBe(mcpAccessMessages.en.errors.core.unexpected);
  });

  it("are translated, not copied", () => {
    expect(mcpAccessMessages.pl.page.title).not.toBe(mcpAccessMessages.en.page.title);
    expect(mcpAccessMessages.pl.setup.assistantPrompt).not.toBe(mcpAccessMessages.en.setup.assistantPrompt);
  });

  it.each(["en", "pl"] as const)("keep both placeholders of the assistant prompt in %s", (locale) => {
    expect(mcpAccessMessages[locale].setup.assistantPrompt).toContain("{serverName}");
    expect(mcpAccessMessages[locale].setup.assistantPrompt).toContain("{command}");
  });
});
