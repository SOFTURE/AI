// The waitlist's confirmation link keeps the channel of the page the form was sent from, so a
// double opt-in sign-up is counted under it when the link is used (waitlist README §10,
// e2e/analytics-funnel.spec.ts).
import type { SoftureConfig } from "@softure-ai/core";
import { getChannel } from "@softure-ai/analytics/next";
import { withChannel } from "@softure-ai/analytics/server";

export async function tagConfirmationLink(path: string, { config }: { readonly config: SoftureConfig }): Promise<string> {
  const channel = await getChannel(config);
  if (channel === null) return path;
  const url = withChannel(config, new URL(path, config.appOrigin), channel);
  return `${url.pathname}${url.search}`;
}
