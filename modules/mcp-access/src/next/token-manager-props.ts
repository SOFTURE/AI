// The data `TokenManager` shows, built on the server for one user: what `McpAccessPage` renders, for an
// app that composes its own page around `TokenManager`. Dates are formatted here, once, in the app's
// locale and time zone, so the server render and hydration never differ.
import { formatMessage, type SoftureConfig } from "@softure-ai/core";
import { getSoftureConfig } from "@softure-ai/core/next";
import type { AccessTokenStatus, AccessTokenView, OAuthGrantView } from "../contract.js";
import type { McpAccessMessages } from "../messages/index.js";
import type { McpAccessOptions } from "../options.js";
import { getLocalizedText, getMcpAccessMessages, getMcpAccessOptions } from "../server/options.js";
import { listOAuthGrants } from "../server/oauth.js";
import { listAccessTokens } from "../server/tokens.js";
import { getAccessTokenStatus } from "../token-status.js";
import type { TokenManagerGrant, TokenManagerProps, TokenManagerRow, TokenManagerTool } from "../ui/token-manager.js";
import { getMcpAccessContext } from "./context.js";
import { formatDate, formatDateTime } from "./format.js";

/** Every prop of `TokenManager` but the actions and the styling. */
export type TokenManagerData = Pick<TokenManagerProps, "tools" | "tokens" | "grants" | "allowWrites" | "maxTokens" | "messages" | "locale">;

export interface TokenManagerPropsInput {
  /** The signed-in user's id, from the app's session check: only this user's tokens and apps are listed. */
  readonly userId: string;
  /** Default: the registered config (`getSoftureConfig()`). */
  readonly config?: SoftureConfig;
  /** The moment token statuses are computed for. Default: the module clock's now. */
  readonly now?: Date;
}

function describeStatus(status: AccessTokenStatus, messages: McpAccessMessages): string {
  switch (status.kind) {
    case "active":
      return messages.list.active;
    case "expired":
      return messages.list.expired;
    case "expiring":
      if (status.daysLeft === 0) return messages.list.expiresToday;
      if (status.daysLeft === 1) return messages.list.expiresTomorrow;
      return formatMessage(messages.list.expiresInDays, { days: status.daysLeft });
  }
}

function toRow(token: AccessTokenView, now: Date, config: SoftureConfig, options: McpAccessOptions, messages: McpAccessMessages): TokenManagerRow {
  const status = getAccessTokenStatus(token.expiresAt, now, { timezone: config.timezone, warningDays: options.expiryWarningDays });
  const isExpired = status.kind === "expired";
  const expiry = formatMessage(isExpired ? messages.list.expiredOn : messages.list.expiresOn, { date: formatDate(config, token.expiresAt) });
  const lastUse = token.lastUsedAt === null ? messages.list.neverUsed : formatMessage(messages.list.lastUsed, { date: formatDateTime(config, token.lastUsedAt) });
  return {
    id: token.id,
    name: token.name,
    scopeText: token.canWrite && options.allowWrites ? messages.list.readWrite : messages.list.readOnly,
    statusText: describeStatus(status, messages),
    isExpired,
    details: [formatMessage(messages.list.createdOn, { date: formatDate(config, token.createdAt) }), expiry, lastUse],
  };
}

function toGrant(grant: OAuthGrantView, config: SoftureConfig, options: McpAccessOptions, messages: McpAccessMessages): TokenManagerGrant {
  const lastUse = grant.lastUsedAt === null ? messages.list.neverUsed : formatMessage(messages.list.lastUsed, { date: formatDateTime(config, grant.lastUsedAt) });
  return {
    id: grant.id,
    clientName: grant.clientName,
    scopeText: grant.canWrite && options.allowWrites ? messages.list.readWrite : messages.list.readOnly,
    details: [formatMessage(messages.grants.connectedOn, { date: formatDate(config, grant.createdAt) }), lastUse],
  };
}

function toTool(tool: McpAccessOptions["tools"][number], config: SoftureConfig, options: McpAccessOptions, messages: McpAccessMessages): TokenManagerTool {
  const accessText = tool.access === "read" ? messages.tools.read : options.allowWrites ? messages.tools.write : messages.tools.writeUnavailable;
  return { name: tool.name, description: getLocalizedText(tool.description, config.locale), accessText };
}

/**
 * The tools, the user's tokens and (while OAuth is on) connected apps, and the page settings, ready to
 * spread into `TokenManager` next to the actions. Reads the database; it checks no session itself.
 */
export async function getTokenManagerProps({ userId, config = getSoftureConfig(), now }: TokenManagerPropsInput): Promise<TokenManagerData> {
  const options = getMcpAccessOptions(config);
  const messages = getMcpAccessMessages(config);
  const ctx = await getMcpAccessContext(config);
  const at = now ?? ctx.clock.now();
  const tokens = await listAccessTokens(ctx, userId);
  const grants = options.oauth.enabled ? await listOAuthGrants(ctx, userId) : null;
  return {
    tools: options.tools.map((tool) => toTool(tool, config, options, messages)),
    tokens: tokens.map((token) => toRow(token, at, config, options, messages)),
    ...(grants === null ? {} : { grants: grants.map((grant) => toGrant(grant, config, options, messages)) }),
    allowWrites: options.allowWrites,
    maxTokens: options.maxTokensPerUser,
    messages,
    locale: config.locale,
  };
}
