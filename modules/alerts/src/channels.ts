// Channels: where a message goes. A channel is an object with a `deliver` function; the factories below build the
// chat webhooks over `requestBytes` (any answer body, since Slack answers a plain `ok`). The mail channel lives in
// `@softure-ai/alerts/mailing`, so an app without mailing never loads it. A URL or token may be `undefined` (an unset
// environment variable): the config still loads, and each delivery fails with `alerts.channel_unconfigured`.
import { err, ok, requestBytes, type FetchFunction, type HttpBytesFailure, type SoftureConfig } from "@softure-ai/core";
import type { AlertMessage, AlertSeverity, AlertsErrorCode, ChannelFailure, ChannelResult } from "./contract.js";
import type { QuietHoursInput } from "./quiet-hours.js";

/** The rendered message a channel sends, with the data behind it. */
export interface AlertDelivery {
  /** The configured name of the channel, e.g. `ops`. */
  readonly channel: string;
  readonly message: AlertMessage;
  /** One line: the tag and the title, e.g. `[Critical] Queue ai.reply: a job failed`. */
  readonly subject: string;
  /** The subject, the details, the repeat count and the link, one per line. */
  readonly text: string;
}

export interface AlertChannelContext {
  readonly config: SoftureConfig;
}

export type DeliverAlert = (delivery: AlertDelivery, context: AlertChannelContext) => Promise<ChannelResult>;

/** Options every channel takes. */
export interface AlertChannelOptions {
  /** Messages below this severity are not sent to the channel; default `info` (all). */
  readonly minSeverity?: AlertSeverity;
  /** A local window in which messages below the exempt severities wait for its end. */
  readonly quietHours?: QuietHoursInput;
}

/** A channel as `alerts({ channels })` takes it. */
export interface AlertChannel extends AlertChannelOptions {
  /** What it is, for logs and the test command: `slack`, `discord`, `telegram`, `webhook`, `mail` or the app's own. */
  readonly kind: string;
  readonly deliver: DeliverAlert;
}

/** A channel of the app's own (a pager, an SMS gateway): `defineAlertChannel({ kind: "sms", deliver })`. */
export function defineAlertChannel(channel: AlertChannel): AlertChannel {
  return channel;
}

interface WebhookOptions extends AlertChannelOptions {
  /** Defaults to the global `fetch`; tests pass a fake. */
  readonly fetch?: FetchFunction;
  /** Milliseconds before a delivery gives up; default 10 000. */
  readonly timeoutMs?: number;
}

export interface SlackChannelOptions extends WebhookOptions {
  /** The incoming webhook URL (`https://hooks.slack.com/services/...`), from the environment. */
  readonly url: string | undefined;
}

export interface DiscordChannelOptions extends WebhookOptions {
  /** The webhook URL (`https://discord.com/api/webhooks/...`), from the environment. */
  readonly url: string | undefined;
}

export interface TelegramChannelOptions extends WebhookOptions {
  /** The bot token from BotFather, from the environment. It is part of the request URL, which is never logged. */
  readonly botToken: string | undefined;
  /** The chat, group or channel id (`-1001234567890` or `@channel_name`). */
  readonly chatId: string | undefined;
  /** The Bot API origin; default `https://api.telegram.org`. */
  readonly apiOrigin?: string;
}

export interface WebhookChannelOptions extends WebhookOptions {
  /** Receives a JSON POST: the message's fields plus `subject` and `text`. */
  readonly url: string | undefined;
  /** Extra headers, e.g. an `Authorization` the receiver checks. */
  readonly headers?: Readonly<Record<string, string>>;
}

const DISCORD_MAX_CONTENT = 2000;
const TELEGRAM_MAX_TEXT = 4096;
const SLACK_MAX_TEXT = 3000;
// Webhook answers are a short acknowledgement; anything bigger is not read.
const MAX_ANSWER_BYTES = 64 * 1024;

/** A Slack incoming webhook: `{ "text": ... }`. */
export function slackChannel(options: SlackChannelOptions): AlertChannel {
  return {
    kind: "slack",
    ...pickChannelOptions(options),
    deliver: (delivery) => postJson(options.url, { text: truncate(delivery.text, SLACK_MAX_TEXT) }, options),
  };
}

/** A Discord webhook: `{ "content": ... }`, at most 2000 characters, mentions disabled. */
export function discordChannel(options: DiscordChannelOptions): AlertChannel {
  return {
    kind: "discord",
    ...pickChannelOptions(options),
    deliver: (delivery) =>
      postJson(options.url, { content: truncate(delivery.text, DISCORD_MAX_CONTENT), allowed_mentions: { parse: [] } }, options),
  };
}

/** A Telegram bot's `sendMessage`, plain text (no Markdown to escape), at most 4096 characters. */
export function telegramChannel(options: TelegramChannelOptions): AlertChannel {
  return {
    kind: "telegram",
    ...pickChannelOptions(options),
    deliver: (delivery) => {
      if (options.botToken === undefined || options.botToken === "" || options.chatId === undefined || options.chatId === "") {
        return Promise.resolve(err("alerts.channel_unconfigured"));
      }
      const origin = options.apiOrigin ?? "https://api.telegram.org";
      const url = `${origin}/bot${options.botToken}/sendMessage`;
      const body = { chat_id: options.chatId, text: truncate(delivery.text, TELEGRAM_MAX_TEXT), disable_web_page_preview: true };
      return postJson(url, body, options);
    },
  };
}

/** A generic JSON POST of the message, for a receiver of the app's own or a service with its own format. */
export function webhookChannel(options: WebhookChannelOptions): AlertChannel {
  return {
    kind: "webhook",
    ...pickChannelOptions(options),
    deliver: (delivery) =>
      postJson(options.url, { ...delivery.message, channel: delivery.channel, subject: delivery.subject, text: delivery.text }, options),
  };
}

function pickChannelOptions(options: AlertChannelOptions): AlertChannelOptions {
  return {
    ...(options.minSeverity === undefined ? {} : { minSeverity: options.minSeverity }),
    ...(options.quietHours === undefined ? {} : { quietHours: options.quietHours }),
  };
}

async function postJson(url: string | undefined, body: unknown, options: WebhookOptions & { readonly headers?: Readonly<Record<string, string>> }): Promise<ChannelResult> {
  if (url === undefined || url === "") return err("alerts.channel_unconfigured");
  const answer = await requestBytes({
    url,
    method: "POST",
    body,
    maxBytes: MAX_ANSWER_BYTES,
    ...(options.headers === undefined ? {} : { headers: options.headers }),
    ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
    ...(options.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs }),
  });
  return answer.ok ? ok() : toChannelFailure(answer);
}

/** Maps a `requestBytes` failure: refused and malformed answers are final, rate limits wait, the rest retries. */
export function toChannelFailure(failure: HttpBytesFailure): ChannelResult {
  switch (failure.error) {
    case "core.http_too_large":
      // A 2xx with a long body still delivered the message.
      return failure.status >= 200 && failure.status < 300 ? ok() : err("alerts.channel_refused");
    case "core.http_rate_limited":
      return withRetryAfter("alerts.channel_rate_limited", failure.retryAfterSeconds);
    case "core.http_unavailable":
      return withRetryAfter("alerts.channel_unavailable", failure.retryAfterSeconds);
    case "core.http_unreachable":
      return err("alerts.channel_unavailable");
    case "core.http_refused":
    case "core.http_conflict":
    case "core.http_unexpected_answer":
      return err("alerts.channel_refused");
  }
}

function withRetryAfter(code: AlertsErrorCode, seconds: number | null): ChannelFailure {
  return seconds === null ? err(code) : { ...err(code), retryAfterSeconds: seconds };
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}
