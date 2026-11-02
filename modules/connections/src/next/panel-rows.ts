// The panel's rows from the connection views: the page uses them, and an app that builds the page inside its own
// shell (`listConnections` + `ConnectionsPanel` + the actions) uses the same mapping.
import { formatMessage, pickLocalizedText, type SoftureConfig } from "@softure-ai/core";
import type { ConnectionView } from "../contract.js";
import { getConnectionsErrorMessage, type ConnectionsMessages } from "../messages/index.js";
import { DEFAULT_ACCOUNT_ID } from "../options.js";
import { getConnectionsOptions } from "../server/options.js";
import type { ConnectionPanelRow } from "../ui/connections-panel.js";

/** What the mapping reads from the configuration: dates in its locale and time zone, the providers' hints. */
export type PanelRowsConfig = SoftureConfig;

/** One `ConnectionsPanel` row per view, in order, with every line already in the app's copy. */
export function toConnectionPanelRows(views: readonly ConnectionView[], messages: ConnectionsMessages, config: PanelRowsConfig): ConnectionPanelRow[] {
  const format = new Intl.DateTimeFormat(config.locale, { dateStyle: "medium", timeStyle: "short", timeZone: config.timezone });
  const date = (value: Date) => format.format(value);
  const providers = getConnectionsOptions(config).providers;
  return views.map((view) => {
    const provider = providers.find((candidate) => candidate.id === view.provider);
    const hint = provider !== undefined && provider.kind !== "oauth" && provider.hint !== undefined ? pickLocalizedText(provider.hint, config.locale, "") : "";
    const isConnected = view.status !== "not_connected";
    const details: string[] = [];
    if (view.accountId !== DEFAULT_ACCOUNT_ID) details.push(formatMessage(messages.details.account, { account: view.accountId }));
    if (isConnected && view.connectedAt !== null) details.push(formatMessage(messages.details.connectedAt, { date: date(view.connectedAt) }));
    if (isConnected && view.kind === "oauth") {
      details.push(view.refreshedAt === null ? messages.details.neverRefreshed : formatMessage(messages.details.refreshedAt, { date: date(view.refreshedAt) }));
      if (view.expiresAt !== null) details.push(formatMessage(messages.details.expiresAt, { date: date(view.expiresAt) }));
      if (view.refreshExpiresAt !== null) details.push(formatMessage(messages.details.refreshExpiresAt, { date: date(view.refreshExpiresAt) }));
      details.push(view.scopes.length === 0 ? messages.details.noScopes : formatMessage(messages.details.scopes, { scopes: view.scopes.join(", ") }));
    }
    return {
      provider: view.provider,
      accountId: view.accountId,
      kind: view.kind,
      label: view.label,
      status: view.status,
      statusLabel: messages.status[view.status],
      details,
      lastError:
        view.lastError === null || view.lastErrorAt === null
          ? null
          : formatLastError(view, { date: date(view.lastErrorAt), error: getConnectionsErrorMessage(messages, view.lastError) }, messages),
      hint: hint === "" ? null : hint,
    };
  });
}

/** The last failure in the app's copy, with what the token endpoint answered when the row keeps it. */
function formatLastError(view: ConnectionView, line: { readonly date: string; readonly error: string }, messages: ConnectionsMessages): string {
  const parts: string[] = [];
  if (view.lastErrorHttpStatus !== null) parts.push(formatMessage(messages.details.httpStatus, { status: String(view.lastErrorHttpStatus) }));
  if (view.lastErrorOAuthError !== null) parts.push(formatMessage(messages.details.oauthError, { code: view.lastErrorOAuthError }));
  if (parts.length === 0) return formatMessage(messages.details.lastError, line);
  return formatMessage(messages.details.lastErrorDetail, { ...line, detail: parts.join(", ") });
}
