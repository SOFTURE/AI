// The mail channel: alerts as transactional mail through `@softure-ai/mailing`, from a named operator sender
// (`mailing({ senders: { alerts: "App alerts <alerts@example.com>" } })`). An optional peer: only apps that import
// this entry need mailing.
import { createHash } from "node:crypto";
import { err, ok } from "@softure-ai/core";
import type { MailingErrorCode } from "@softure-ai/mailing";
import { sendMail } from "@softure-ai/mailing/server";
import type { AlertChannel, AlertChannelOptions, AlertDelivery } from "../channels.js";
import type { ChannelResult } from "../contract.js";
import { renderAlertMailHtml } from "./html.js";

export { parseAlertDetails, renderAlertMailHtml, type AlertDetailsBlock } from "./html.js";

export interface MailChannelOptions extends AlertChannelOptions {
  /** The operator's address, exactly one; an unset environment variable leaves it `undefined`. */
  readonly to: string | undefined;
  /** A name of `mailing({ senders })`, e.g. `alerts`; without it the mail goes out from mailing's `from`. */
  readonly sender?: string;
  /**
   * The HTML part next to the text; default `renderAlertMailHtml` (one column, severity badge, details as a list,
   * link button). Return `undefined` for text only, e.g. `html: () => undefined`.
   */
  readonly html?: (delivery: AlertDelivery) => string | undefined;
}

/** Alerts by mail: the subject line as the subject, the full text as the text part, and an HTML part. */
export function mailChannel(options: MailChannelOptions): AlertChannel {
  return {
    kind: "mail",
    ...(options.minSeverity === undefined ? {} : { minSeverity: options.minSeverity }),
    ...(options.quietHours === undefined ? {} : { quietHours: options.quietHours }),
    deliver: async (delivery, { config }) => {
      if (options.to === undefined || options.to === "") return err("alerts.channel_unconfigured");
      const html = (options.html ?? renderAlertMailHtml)(delivery);
      const result = await sendMail(
        { config },
        {
          to: options.to,
          subject: delivery.subject,
          text: delivery.text,
          ...(html === undefined ? {} : { html }),
          ...(options.sender === undefined ? {} : { sender: options.sender }),
        },
        { idempotencyKey: getAlertIdempotencyKey(delivery) },
      );
      return result.ok ? ok() : toMailChannelResult(result.error, result.retryAfterSeconds);
    },
  };
}

/**
 * The idempotency key of a delivery: the same delivery retried is the same mail for the provider. Exported for an
 * app's own mail channel (`defineAlertChannel`).
 */
export function getAlertIdempotencyKey(delivery: AlertDelivery): string {
  const { message } = delivery;
  const digest = createHash("sha256").update([delivery.channel, message.key, message.kind, message.at].join("\n")).digest("hex");
  return `alerts-${digest}`;
}

/**
 * Maps a failed `sendMail` to the channel result the delivery job retries or gives up on: unavailable and quota
 * keep `retryAfterSeconds`, a refusal is final. Exported for an app's own mail channel.
 */
export function toMailChannelResult(code: MailingErrorCode, retryAfterSeconds: number | undefined): ChannelResult {
  switch (code) {
    case "mailing.unavailable":
      return retryAfterSeconds === undefined ? err("alerts.channel_unavailable") : { ...err("alerts.channel_unavailable"), retryAfterSeconds };
    case "mailing.quota_exceeded":
      return retryAfterSeconds === undefined ? err("alerts.channel_rate_limited") : { ...err("alerts.channel_rate_limited"), retryAfterSeconds };
    case "mailing.invalid_input":
    case "mailing.rejected":
    case "mailing.suppressed":
    case "mailing.provider_refused":
      return err("alerts.channel_refused");
  }
}
