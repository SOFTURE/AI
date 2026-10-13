import { getTokenErrorMessage, mcpAccessMessages, type TokenFormErrorCode } from "@softure-ai/mcp-access";
import { describe, expect, it } from "vitest";

const CODES: TokenFormErrorCode[] = [
  "mcp-access.name_required",
  "mcp-access.name_too_long",
  "mcp-access.token_limit_reached",
  "mcp-access.token_not_found",
  "mcp-access.grant_not_found",
  "auth.unauthenticated",
  "core.database_failed",
  "core.unexpected",
];

describe("mcp-access messages", () => {
  it("have English copy for every code the page can show", () => {
    for (const code of CODES) {
      const message = getTokenErrorMessage(mcpAccessMessages.en, code);
      expect(message, code).not.toBe("");
      expect(message === mcpAccessMessages.en.errors.core.unexpected, code).toBe(code === "core.unexpected" || code === "core.database_failed");
    }
  });

  it("fall back to the generic failure for a code they do not know", () => {
    // @ts-expect-error: a code from a newer server than the dictionary.
    expect(getTokenErrorMessage(mcpAccessMessages.en, "mcp-access.something_new")).toBe(mcpAccessMessages.en.errors.core.unexpected);
    // @ts-expect-error: an inherited property is not a message.
    expect(getTokenErrorMessage(mcpAccessMessages.en, "auth.toString")).toBe(mcpAccessMessages.en.errors.core.unexpected);
  });

  it("ship English as the only built-in language", () => {
    expect(Object.keys(mcpAccessMessages)).toEqual(["en"]);
  });

  it("keep both placeholders of the assistant prompt", () => {
    expect(mcpAccessMessages.en.setup.assistantPrompt).toContain("{serverName}");
    expect(mcpAccessMessages.en.setup.assistantPrompt).toContain("{command}");
  });
});
