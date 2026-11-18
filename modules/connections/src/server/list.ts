// Every declared provider account as the page and the app see it, with its health. Reads no secret. The app's own
// connections (`listConnections`, for the admin page) and one user's own (`listOwnConnections`) never mix.
import { and, eq, inArray, isNull } from "drizzle-orm";
import type { ConnectionStatus, ConnectionView } from "../contract.js";
import type { ProviderDefinition } from "../options.js";
import { accounts, type AccountRow } from "../schema.js";
import { getConnectionsOptions, getProviderLabel } from "./options.js";
import { getProviderOwner, whereConnection, type ConnectionsContext } from "./store.js";

/** One view per declared app provider and account, in the order the app declared them. Users' own connections are not here. */
export async function listConnections(ctx: ConnectionsContext): Promise<ConnectionView[]> {
  const providers = getConnectionsOptions(ctx.config).providers.filter((provider) => getProviderOwner(provider) === "app");
  if (providers.length === 0) return [];
  const rows = await ctx.db
    .select()
    .from(accounts)
    .where(and(inArray(accounts.provider, providers.map((provider) => provider.id)), isNull(accounts.ownerId)));
  return toViews(ctx, providers, rows, null);
}

/**
 * One view per declared user provider (`owner: "user"`) and account for one user: their own connections, connected or
 * not, in the order the app declared them.
 */
export async function listOwnConnections(ctx: ConnectionsContext, ownerId: string): Promise<ConnectionView[]> {
  const providers = getConnectionsOptions(ctx.config).providers.filter((provider) => getProviderOwner(provider) === "user");
  if (providers.length === 0) return [];
  const rows = await ctx.db
    .select()
    .from(accounts)
    .where(and(inArray(accounts.provider, providers.map((provider) => provider.id)), eq(accounts.ownerId, ownerId)));
  return toViews(ctx, providers, rows, ownerId);
}

function toViews(ctx: ConnectionsContext, providers: readonly ProviderDefinition[], rows: readonly AccountRow[], ownerId: string | null): ConnectionView[] {
  const byKey = new Map(rows.map((row) => [`${row.provider}/${row.accountId}`, row]));
  const now = ctx.clock.now();
  return providers.flatMap((provider) =>
    provider.accounts.map((accountId) => toView(ctx, { provider, accountId, ownerId }, byKey.get(`${provider.id}/${accountId}`), now)),
  );
}

/** The view of one provider account: the app's, or the user's own when `ownerId` is given. */
export async function getConnection(ctx: ConnectionsContext, provider: ProviderDefinition, accountId: string, ownerId: string | null = null): Promise<ConnectionView> {
  const [row] = await ctx.db.select().from(accounts).where(whereConnection(provider.id, accountId, ownerId));
  return toView(ctx, { provider, accountId, ownerId }, row, ctx.clock.now());
}

interface ViewTarget {
  readonly provider: ProviderDefinition;
  readonly accountId: string;
  readonly ownerId: string | null;
}

function toView(ctx: ConnectionsContext, target: ViewTarget, row: AccountRow | undefined, now: Date): ConnectionView {
  const { provider, accountId, ownerId } = target;
  return {
    provider: provider.id,
    accountId,
    ownerId,
    subject: row?.subject ?? null,
    kind: provider.kind,
    label: getProviderLabel(ctx.config, provider),
    status: row === undefined ? "not_connected" : getStatus(ctx, row, now),
    scopes: row?.scopes ?? [],
    expiresAt: row?.expiresAt ?? null,
    refreshExpiresAt: row?.refreshExpiresAt ?? null,
    connectedAt: row?.connectedAt ?? null,
    connectedBy: row?.connectedBy ?? null,
    refreshedAt: row?.refreshedAt ?? null,
    lastError: row?.lastError ?? null,
    lastErrorAt: row?.lastErrorAt ?? null,
    lastErrorHttpStatus: row?.lastErrorHttpStatus ?? null,
    lastErrorOAuthError: row?.lastErrorOAuthError ?? null,
  };
}

/**
 * A stored connection's health. The grant dies with its refresh token, or with its access token when it has no
 * refresh token: past that moment it needs a reconnect, within `expiringWithinHours` of it it is expiring.
 */
export function getStatus(ctx: ConnectionsContext, row: AccountRow, now: Date): Exclude<ConnectionStatus, "not_connected"> {
  if (row.status === "reconnect_required") return "reconnect_required";
  const deadline = row.hasRefreshToken ? row.refreshExpiresAt : row.expiresAt;
  if (deadline === null) return "connected";
  const remaining = deadline.getTime() - now.getTime();
  if (remaining <= 0) return "reconnect_required";
  return remaining <= getConnectionsOptions(ctx.config).expiringWithinHours * 3_600_000 ? "expiring" : "connected";
}
