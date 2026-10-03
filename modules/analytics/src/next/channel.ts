// The Next.js adapter: the channel of the current request, for server actions, route handlers,
// auth's `onRegistered` hook and pages. `next/headers` is imported when a function runs, not when
// the file loads, so `softure.config.ts` (which `softure migrate` loads in plain Node) can import
// `attributeRegistration` from here.
import type { SoftureConfig } from "@softure-ai/core";
import { getSoftureConfig } from "@softure-ai/core/next";
import { parseChannel, readChannel } from "../server/channel.js";
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
