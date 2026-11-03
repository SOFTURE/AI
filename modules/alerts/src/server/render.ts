// The text a channel sends, from the message and the app's copy. Channels decide only the envelope.
import { formatMessage, selectPlural } from "@softure-ai/core";
import type { AlertDelivery, AlertDeliveryParts } from "../channels.js";
import type { AlertMessage } from "../contract.js";
import type { AlertsMessages } from "../messages/index.js";

/** The subject line and the full text of `message` for the channel named `channel`. */
export function renderAlert(channel: string, message: AlertMessage, messages: AlertsMessages, locale: string): AlertDelivery {
  const severity = messages.severity[message.severity];
  const tag = formatMessage(messages.tag[message.kind], { severity });
  const subject = `[${tag}] ${message.title}`;
  const repeats = message.repeats > 0 ? formatMessage(selectPlural(locale, message.repeats, messages.repeats), { count: message.repeats }) : null;
  const link = message.link === null ? null : { label: messages.open, url: message.link };
  const lines = [subject];
  if (message.details !== null) lines.push(message.details);
  if (repeats !== null) lines.push(repeats);
  if (link !== null) lines.push(`${link.label}: ${link.url}`);
  const parts: AlertDeliveryParts = { tag, title: message.title, details: message.details, repeats, link };
  return { channel, message, subject, text: lines.join("\n"), parts };
}
