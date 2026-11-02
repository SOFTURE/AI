// The text a channel sends, from the message and the app's copy. Channels decide only the envelope.
import { formatMessage, selectPlural } from "@softure-ai/core";
import type { AlertDelivery } from "../channels.js";
import type { AlertMessage } from "../contract.js";
import type { AlertsMessages } from "../messages/index.js";

/** The subject line and the full text of `message` for the channel named `channel`. */
export function renderAlert(channel: string, message: AlertMessage, messages: AlertsMessages, locale: string): AlertDelivery {
  const severity = messages.severity[message.severity];
  const tag = formatMessage(messages.tag[message.kind], { severity });
  const subject = `[${tag}] ${message.title}`;
  const lines = [subject];
  if (message.details !== null) lines.push(message.details);
  if (message.repeats > 0) {
    lines.push(formatMessage(selectPlural(locale, message.repeats, messages.repeats), { count: message.repeats }));
  }
  if (message.link !== null) lines.push(`${messages.open}: ${message.link}`);
  return { channel, message, subject, text: lines.join("\n") };
}
