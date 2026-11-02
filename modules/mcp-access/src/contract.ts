// Result types and error codes of the mcp-access module. No user-facing copy here: the UI
// translates codes through `messages` (docs/02-module-standard.md §6).
import type { CoreErrorCode, Err } from "@softure-ai/core";

export type McpAccessErrorCode =
  | "mcp-access.name_required"
  | "mcp-access.name_too_long"
  | "mcp-access.token_limit_reached"
  | "mcp-access.token_not_found"
  | "mcp-access.grant_not_found"
  | "mcp-access.api_disabled"
  | "mcp-access.scope_required"
  | "mcp-access.scope_unknown";

/** Which door a token opens: the MCP endpoint, or the app's HTTP routes through `requireApiToken`. */
export type AccessTokenKind = "mcp" | "api";

/** Why `requireApiToken` refused a request; `apiTokenErrorResponse` turns each into its HTTP answer. */
export type ApiTokenErrorCode =
  | "mcp-access.api_token_missing"
  | "mcp-access.api_token_invalid"
  | "mcp-access.api_scope_missing"
  | "mcp-access.api_writes_disabled"
  | "mcp-access.api_unavailable"
  | "security.client_unidentified"
  | "security.rate_limited";

/** A refusal of `requireApiToken`. */
export type ApiTokenRefusal =
  | Err<Exclude<ApiTokenErrorCode, "security.rate_limited" | "mcp-access.api_scope_missing" | "mcp-access.api_writes_disabled">>
  | (Err<"mcp-access.api_scope_missing" | "mcp-access.api_writes_disabled"> & { readonly missingScopes: readonly string[] })
  | (Err<"security.rate_limited"> & { readonly retryAfterSeconds: number });

/** Who called a route with a valid API token. */
export interface ApiTokenIdentity {
  /** The auth user id of the token's owner: scope every query of the route to it. */
  readonly userId: string;
  /** The token's id, for the route's own logs. Never the token. */
  readonly tokenId: string;
  /** The token's effective scopes: write scopes only while the app allows writes. */
  readonly scopes: readonly string[];
}

/** What an app's `beforeIssue` gate may answer instead of letting a token be issued. */
export type McpIssueRefusalCode = "mcp-access.issue_refused" | "mcp-access.write_refused";

/**
 * A gate's refusal with the app's own text for the user ("Your trial has ended."), shown instead of the
 * code's copy: an `Err` with a `message`, made by `refuseIssue` (`/next`).
 */
export interface McpIssueRefusal extends Err<McpIssueRefusalCode> {
  readonly message: string;
}

/** Every code the token page can show: its own, a gate's refusal, a missing session and the generic ones. */
export type TokenFormErrorCode = McpAccessErrorCode | McpIssueRefusalCode | "auth.unauthenticated" | CoreErrorCode;

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
  readonly kind: AccessTokenKind;
  /** The app scopes of an API token; empty for an MCP token. */
  readonly scopes: readonly string[];
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
  /** The name the client lists the server under: `clientServerName`, else `serverName`. */
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

/** An MCP token right after it was issued: the only moment its plaintext exists outside the client. */
export interface IssuedToken {
  readonly id: string;
  readonly name: string;
  readonly canWrite: boolean;
  /** The expiry, already formatted in the app's locale and time zone. */
  readonly expiresText: string;
  /** The expiry as ISO 8601, for an app that formats it itself. */
  readonly expiresAt: string;
  readonly setup: McpClientSetup;
}

/** A snippet the app gave for API tokens (`apiTokens.examples`), filled in with the new token. */
export interface ApiTokenExample {
  readonly title: string;
  readonly text: string;
}

/** An API token right after it was issued, for the one-time reveal. */
export interface IssuedApiTokenView {
  readonly id: string;
  readonly name: string;
  /** The scopes granted (write scopes only with `allowWrites`). */
  readonly scopes: readonly string[];
  readonly expiresText: string;
  readonly expiresAt: string;
  /** The plaintext, shown once. */
  readonly token: string;
  /** `Bearer <token>`. */
  readonly authorizationHeader: string;
  readonly examples: readonly ApiTokenExample[];
}

/** What the issue action returns to its form (`useActionState`). */
export type IssueTokenFormState =
  | { readonly status: "idle" }
  | { readonly status: "ok"; readonly issued: IssuedToken }
  /** An API token was issued (`kind=api` in the form): its one-time reveal. */
  | { readonly status: "api-ok"; readonly issued: IssuedApiTokenView }
  /** `message`: the app's own refusal text from the `beforeIssue` gate, shown instead of the code's copy. */
  | { readonly status: "error"; readonly error: TokenFormErrorCode; readonly message?: string };

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
