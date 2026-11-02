// Result types, error codes and the message a channel delivers. No user-facing copy here: channels render the text
// through the module's messages (docs/02-module-standard.md §6).
import type { Err, Ok } from "@softure-ai/core";

/** How loud an alert is, from least to most. Quiet hours hold back everything below `critical` by default. */
export const ALERT_SEVERITIES = ["info", "warning", "critical"] as const;
export type AlertSeverity = (typeof ALERT_SEVERITIES)[number];

/** What a delivery says: a new alert, a summary of repeats, a recovery, or a test from `softure-alerts test`. */
export const ALERT_MESSAGE_KINDS = ["fired", "repeated", "resolved", "test"] as const;
export type AlertMessageKind = (typeof ALERT_MESSAGE_KINDS)[number];

/** An alert key: letters, digits and `. _ : / @ -`, 1 to 200 characters, e.g. `jobs.failed:ai.reply`. */
export const ALERT_KEY_PATTERN = /^[A-Za-z0-9._:/@-]{1,200}$/;
export const MAX_TITLE_LENGTH = 200;
export const MAX_DETAILS_LENGTH = 4000;
export const MAX_LINK_LENGTH = 2000;

export type AlertsErrorCode =
  | "alerts.invalid_input"
  | "alerts.unknown_channel"
  | "alerts.channel_unconfigured"
  | "alerts.channel_refused"
  | "alerts.channel_rate_limited"
  | "alerts.channel_unavailable";

/** What `alert()` takes. Details and link are optional; keep personal data out of all of them. */
export interface AlertInput {
  /** Deduplicates: while an alert with this key fires, repeats are counted instead of sent. */
  readonly key: string;
  readonly severity: AlertSeverity;
  /** One line, 1 to 200 characters. */
  readonly title: string;
  /** More lines, at most 4000 characters. */
  readonly details?: string;
  /** An absolute `http(s)` URL the operator opens, e.g. the admin page of the failed queue. */
  readonly link?: string;
}

/** What a channel delivers: the alert's data and counts, rendered to text by the channel. */
export interface AlertMessage {
  readonly kind: AlertMessageKind;
  readonly key: string;
  readonly severity: AlertSeverity;
  readonly title: string;
  readonly details: string | null;
  readonly link: string | null;
  /** Occurrences since the last message that were not sent on their own (the "happened 37 more times"). */
  readonly repeats: number;
  /** Occurrences since the alert started firing, the first one included. */
  readonly occurrences: number;
  /** When the message was produced, ISO 8601. */
  readonly at: string;
}

/** What `alert()` did: sent a new alert, counted a repeat, or sent a summary of repeats once the window passed. */
export type AlertOutcome = "fired" | "counted" | "repeated";

/** A failed delivery; `retryAfterSeconds` when the service asked to wait (`Retry-After`). */
export type ChannelFailure = Err<AlertsErrorCode> & { readonly retryAfterSeconds?: number };
export type ChannelResult = Ok<undefined> | ChannelFailure;

/** One alert as the admin list shows it. */
export interface AlertRecord {
  readonly key: string;
  readonly severity: AlertSeverity;
  readonly title: string;
  readonly details: string | null;
  readonly link: string | null;
  readonly status: "firing" | "resolved";
  readonly occurrences: number;
  readonly pendingRepeats: number;
  readonly openedAt: Date;
  readonly lastSeenAt: Date;
  readonly lastNotifiedAt: Date;
  readonly resolvedAt: Date | null;
}

/** True when `severity` is at least `minimum`. */
export function isAtLeast(severity: AlertSeverity, minimum: AlertSeverity): boolean {
  return ALERT_SEVERITIES.indexOf(severity) >= ALERT_SEVERITIES.indexOf(minimum);
}
