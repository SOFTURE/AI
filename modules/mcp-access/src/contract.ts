// Result types and error codes of the mcp-access module. No user-facing copy here: the UI
// translates codes through `messages` (docs/02-module-standard.md §6).
import type { CoreErrorCode } from "@softure-ai/core";

export type McpAccessErrorCode =
  | "mcp-access.name_required"
  | "mcp-access.name_too_long"
  | "mcp-access.token_limit_reached"
  | "mcp-access.token_not_found"
  | "mcp-access.grant_not_found";

/** Every code the token page can show: its own, a missing session and the generic ones. */
export type TokenFormErrorCode = McpAccessErrorCode | "auth.unauthenticated" | CoreErrorCode;

/** What the app's MCP server factory receives for one request. */
export interface McpServerIdentity {
  /** The auth user id of the token's owner: every query of the server is scoped to it. */
  readonly userId: string;
  /** Whether write tools may be registered: the app allows writes and the token was issued for them. */
  readonly canWrite: boolean;
  /** The token's id, for the server's own logs. Never the token. */
  readonly tokenId: string;
}

/** A stored token as its owner sees it. The hash never leaves the server functions. */
export interface AccessTokenView {
  readonly id: string;
  readonly name: string;
  /** Issued with write access (it still writes only while the app allows writes). */
  readonly canWrite: boolean;
  readonly createdAt: Date;
  readonly expiresAt: Date;
  readonly lastUsedAt: Date | null;
}

/** Where a token stands on its expiry, for the list. */
export type AccessTokenStatus =
  | { readonly kind: "active" }
  /** `daysLeft`: calendar days in the app's time zone, from 0 (today) to the warning threshold. */
  | { readonly kind: "expiring"; readonly daysLeft: number }
  | { readonly kind: "expired" };

/** Ready-to-paste setup for MCP clients, built around the plaintext token. */
export interface McpClientSetup {
  readonly serverName: string;
  readonly endpointUrl: string;
  /** `claude mcp add …` for Claude Code, with the token in it. */
  readonly claudeCodeCommand: string;
  /** A prompt asking the assistant to run that command and confirm the connection. */
  readonly assistantPrompt: string;
  /** A `claude-cli://` link that opens Claude Code with the prompt (it runs nothing by itself). */
  readonly claudeCodeLink: string;
  /** `mcpServers` JSON for clients configured by file (Cursor, VS Code, Windsurf). */
  readonly jsonConfig: string;
  /** Claude Desktop's file, bridged through `mcp-remote` (it cannot send headers itself). */
  readonly desktopConfig: string;
  /** The `Authorization` header value, for clients with a header field. */
  readonly authorizationHeader: string;
}

/** A token right after it was issued: the only moment its plaintext exists outside the client. */
export interface IssuedToken {
  readonly id: string;
  readonly name: string;
  readonly canWrite: boolean;
  /** The expiry, already formatted in the app's locale and time zone. */
  readonly expiresText: string;
  readonly setup: McpClientSetup;
}

/** What the issue action returns to its form (`useActionState`). */
export type IssueTokenFormState =
  | { readonly status: "idle" }
  | { readonly status: "ok"; readonly issued: IssuedToken }
  | { readonly status: "error"; readonly error: TokenFormErrorCode };

/** A connected app (an OAuth grant) as its owner sees it. */
export interface OAuthGrantView {
  readonly id: string;
  /** The name the client registered with, cut to 60 characters. */
  readonly clientName: string;
  /** Granted with write access (it still writes only while the app allows writes). */
  readonly canWrite: boolean;
  readonly createdAt: Date;
  readonly lastUsedAt: Date | null;
}

/** What the revoke action returns to one token's form. */
export type RevokeTokenFormState =
  | { readonly status: "idle" }
  | { readonly status: "ok" }
  | { readonly status: "error"; readonly error: TokenFormErrorCode };

/** What the disconnect action returns to one connected app's form. */
export type RevokeGrantFormState = RevokeTokenFormState;
