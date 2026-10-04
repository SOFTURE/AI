// The Next.js adapter: the channel of the current request, for server actions (and their
// redirects), route handlers, auth's hooks and pages. `next/headers` is imported when a function
// runs, not when the file loads, so `softure.config.ts` (which `softure migrate` loads in plain
// Node) can import `attributeRegistration` and `tagRedirect` from here.
import { errorLogLabel, type SoftureConfig } from "@softure-ai/core";
import { getSoftureConfig } from "@softure-ai/core/next";
import type { Queryable } from "@softure-ai/db";
import { parseChannel, readChannel, tagPath } from "../server/channel.js";
import { recordFunnelStep, type AnalyticsContext } from "../server/funnel.js";
import { getChannelOptions } from "../server/options.js";

/** A page's `searchParams`, awaited, or any `URLSearchParams`. */
export type SearchParamsInput = URLSearchParams | Readonly<Record<string, string | readonly string[] | undefined>>;

/**
 * The channel of the request being handled, from the same-origin page it was sent from (`Referer`).
 * For server actions and hooks they run in: an action is posted from the page that shows the tag.
 * Pages read their own URL with `getChannelFromSearchParams` instead.
 */
export async function getChannel(config: SoftureConfig = getSoftureConfig()): Promise<string | null> {
  const { headers } = await import("next/headers");
  const requestHeaders = await headers();
  return readChannel(config, { referer: requestHeaders.get("referer"), host: requestHeaders.get("host") });
}

/** The channel in a page's `searchParams`; the first value when the parameter repeats. */
export function getChannelFromSearchParams(searchParams: SearchParamsInput, config: SoftureConfig = getSoftureConfig()): string | null {
  const options = getChannelOptions(config);
  if (searchParams instanceof URLSearchParams) return parseChannel(searchParams.get(options.param), options);
  const value = searchParams[options.param];
  return parseChannel(typeof value === "string" ? value : value?.[0], options);
}

/** What `tagRedirect` reads besides the path; auth's `rewriteRedirect` context fits it. */
export interface TagRedirectContext {
  readonly config: SoftureConfig;
  /** A page's own search params, when the page redirects while it renders. */
  readonly searchParams?: SearchParamsInput;
}

/**
 * `path` with the channel of the request being handled, for a `redirect()`: Next renders the
 * redirect target (and a browser without JavaScript follows it) from that URL, where the proxy
 * cannot tag it. For an action the channel comes from the page it was posted from (`Referer`); for
 * a page's own redirect, from `ctx.searchParams` alone (the render's `Referer` is the page before).
 * The path is returned unchanged without a channel or when it already carries the parameter. Fits
 * auth's option: `auth({ rewriteRedirect: tagRedirect })`; in the app's own actions:
 * `redirect(await tagRedirect("/thanks"))`; in a page: `redirect(await tagRedirect("/", { config, searchParams }))`.
 */
export async function tagRedirect(path: string, ctx: TagRedirectContext = { config: getSoftureConfig() }): Promise<string> {
  const channel = ctx.searchParams === undefined ? await getChannel(ctx.config) : getChannelFromSearchParams(ctx.searchParams, ctx.config);
  return channel === null ? path : tagPath(ctx.config, path, channel);
}

/** What `attributeRegistration` hands the app: the new account and the channel it came from. */
export interface RegistrationAttribution {
  readonly userId: string;
  readonly channel: string;
}

/** The part of auth's `RegisteredEvent` the attribution reads (this module does not depend on auth). */
export interface RegisteredUserEvent {
  readonly user: { readonly id: string };
}

/**
 * An `onRegistered` hook for auth that calls `onChannel` when the sign-up came with a channel, in
 * the account's transaction (`ctx` is the hook's context). Without a channel it does nothing.
 * `auth({ onRegistered: attributeRegistration((attribution, ctx) => saveChannel(ctx.db, attribution)) })`
 */
export function attributeRegistration<TContext extends { readonly config: SoftureConfig }>(
  onChannel: (attribution: RegistrationAttribution, ctx: TContext) => Promise<void> | void,
): (event: RegisteredUserEvent, ctx: TContext) => Promise<void> {
  return async (event, ctx) => {
    const channel = await getChannel(ctx.config);
    if (channel !== null) await onChannel({ userId: event.user.id, channel }, ctx);
  };
}

/**
 * An `onRegistered` hook for auth that counts `step` (a `server` step of the funnel) for every
 * sign-up, with its channel or without one. The count runs in a savepoint of the account's
 * transaction and a failure is logged, never thrown: a broken counter must not refuse sign-ups.
 * `auth({ onRegistered: countRegistration("signup") })`
 */
export function countRegistration<TContext extends AnalyticsContext>(step: string): (event: RegisteredUserEvent, ctx: TContext) => Promise<void> {
  return async (_event, ctx) => {
    try {
      const channel = await getChannel(ctx.config);
      // A failed statement aborts the whole transaction; the savepoint keeps the sign-up intact.
      await ctx.db.transaction((tx: Queryable) => recordFunnelStep({ ...ctx, db: tx }, { step, channel }));
    } catch (error) {
      console.error(`@softure-ai/analytics: counting the funnel step "${step}" for a sign-up failed: ${errorLogLabel(error)}`);
    }
  };
}
