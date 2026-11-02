// One delivery: find the channel, render the text in the app's copy and hand it over. Used by the delivery job and,
// without a queue, by `softure-alerts test`.
import { err, type SoftureConfig } from "@softure-ai/core";
import type { AlertMessage, ChannelResult } from "../contract.js";
import { getAlertsMessages, getAlertsOptions } from "./options.js";
import { renderAlert } from "./render.js";

/** Delivers `message` to the configured channel `channel`; `alerts.unknown_channel` for a name the config lacks. */
export async function deliverToChannel(config: SoftureConfig, channel: string, message: AlertMessage): Promise<ChannelResult> {
  const { channels } = getAlertsOptions(config);
  const configured = Object.hasOwn(channels, channel) ? channels[channel] : undefined;
  if (configured === undefined) return err("alerts.unknown_channel");
  const delivery = renderAlert(channel, message, getAlertsMessages(config), config.locale);
  return configured.deliver(delivery, { config });
}
