// The window in which dynamic client registration is open while `oauth.registration` is "closed"
// (#520): one stored row with its end, written by the `open-client-registration` ops script. Every
// comparison uses the context's clock, so tests and scripts agree with the route.
import { oauthRegistrationWindow } from "../schema.js";
import { getMcpAccessOptions } from "./options.js";
import type { McpAccessContext } from "./tokens.js";

/** The longest window one call opens: a day. */
export const MAX_REGISTRATION_WINDOW_MINUTES = 1440;

export interface ClientRegistrationWindow {
  readonly openedAt: Date;
  readonly openUntil: Date;
}

export interface OpenClientRegistrationInput {
  /** Minutes from now, 1 to 1440. */
  readonly minutes: number;
}

/** The stored window, past or not; null when none is stored. */
export async function findClientRegistrationWindow(ctx: McpAccessContext): Promise<ClientRegistrationWindow | null> {
  const [row] = await ctx.db
    .select({ openedAt: oauthRegistrationWindow.openedAt, openUntil: oauthRegistrationWindow.openUntil })
    .from(oauthRegistrationWindow)
    .limit(1);
  return row ?? null;
}

/** True with `oauth.registration: "open"`; with "closed", only while a stored window has not ended. */
export async function isClientRegistrationOpen(ctx: McpAccessContext): Promise<boolean> {
  if (getMcpAccessOptions(ctx.config).oauth.registration === "open") return true;
  const window = await findClientRegistrationWindow(ctx);
  return window !== null && window.openUntil.getTime() > ctx.clock.now().getTime();
}

/** Opens registration for `minutes` from now, replacing any stored window. Throws on minutes outside 1 to 1440: a bug in the caller. */
export async function openClientRegistration(ctx: McpAccessContext, input: OpenClientRegistrationInput): Promise<ClientRegistrationWindow> {
  if (!Number.isInteger(input.minutes) || input.minutes < 1 || input.minutes > MAX_REGISTRATION_WINDOW_MINUTES) {
    throw new Error(`openClientRegistration: minutes must be a whole number from 1 to ${String(MAX_REGISTRATION_WINDOW_MINUTES)}, got ${String(input.minutes)}`);
  }
  const openedAt = ctx.clock.now();
  const openUntil = new Date(openedAt.getTime() + input.minutes * 60_000);
  await ctx.db
    .insert(oauthRegistrationWindow)
    .values({ id: 1, openedAt, openUntil })
    .onConflictDoUpdate({ target: oauthRegistrationWindow.id, set: { openedAt, openUntil } });
  return { openedAt, openUntil };
}

/** Deletes the stored window. True when one was stored, ended or not. */
export async function closeClientRegistration(ctx: McpAccessContext): Promise<boolean> {
  const deleted = await ctx.db.delete(oauthRegistrationWindow).returning({ id: oauthRegistrationWindow.id });
  return deleted.length > 0;
}
