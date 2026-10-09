// The token page, ready to mount with one line:
// `export { McpAccessPage as default } from "@softure-ai/mcp-access/next"`.
// A server component for the signed-in user; without a session it redirects to the login page and
// back. Everything the client part shows is prepared here, so dates are formatted once, in the
// app's locale and time zone, and never differ between the server render and hydration.
import { requireUser } from "@softure-ai/auth/next";
import { formatMessage, type SoftureConfig } from "@softure-ai/core";
import { getSoftureConfig } from "@softure-ai/core/next";
import { Card } from "@softure-ai/ui";
import type { AccessTokenStatus, AccessTokenView, OAuthGrantView } from "../contract.js";
import type { McpAccessMessages } from "../messages/index.js";
import type { McpAccessOptions } from "../options.js";
import { getLocalizedText, getMcpAccessMessages, getMcpAccessOptions, getMcpAccessRoutes } from "../server/options.js";
import { listOAuthGrants } from "../server/oauth.js";
import { listAccessTokens } from "../server/tokens.js";
import { getAccessTokenStatus } from "../token-status.js";
import { TokenManager, type IssueTokenAction, type TokenManagerGrant, type TokenManagerRow, type TokenManagerTool } from "../ui/token-manager.js";
import { issueTokenAction, revokeGrantAction, revokeTokenAction } from "./actions.js";
import { getMcpAccessContext } from "./context.js";
import { formatDate, formatDateTime } from "./format.js";

const LAYOUT_CLASS = "sft:mx-auto sft:box-border sft:w-full sft:sm:max-w-3xl sft:px-4 sft:py-4";

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

export interface McpAccessPageProps {
  /**
   * The app's own issue action, e.g. one that calls `issueToken` with a `beforeIssue` gate. Default:
   * `issueTokenAction`, which issues without a gate.
   */
  readonly issueAction?: IssueTokenAction;
}

export async function McpAccessPage({ issueAction = issueTokenAction }: McpAccessPageProps = {}) {
  const config = getSoftureConfig();
  const user = await requireUser({ next: getMcpAccessRoutes(config).page });
  const options = getMcpAccessOptions(config);
  const messages = getMcpAccessMessages(config);
  const ctx = await getMcpAccessContext(config);
  const now = ctx.clock.now();
  const tokens = await listAccessTokens(ctx, user.id);
  const grants = options.oauth.enabled ? await listOAuthGrants(ctx, user.id) : null;
  return (
    <main className={LAYOUT_CLASS}>
      <Card title={messages.page.title} subtitle={messages.page.lead}>
        <TokenManager
          tools={options.tools.map((tool) => toTool(tool, config, options, messages))}
          tokens={tokens.map((token) => toRow(token, now, config, options, messages))}
          allowWrites={options.allowWrites}
          maxTokens={options.maxTokensPerUser}
          issueAction={issueAction}
          revokeAction={revokeTokenAction}
          {...(grants === null ? {} : { grants: grants.map((grant) => toGrant(grant, config, options, messages)), revokeGrantAction })}
          messages={messages}
          locale={config.locale}
        />
      </Card>
    </main>
  );
}
