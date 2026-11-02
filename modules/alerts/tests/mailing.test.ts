// The mail channel: a transactional mail from the named sender through mailing's provider, its idempotency key, and
// the mapping of mailing's codes.
import { alerts, type AlertDelivery } from "@softure-ai/alerts";
import { mailChannel } from "@softure-ai/alerts/mailing";
import { defineSoftureConfig } from "@softure-ai/core";
import { jobs } from "@softure-ai/jobs";
import { mailing, type ProviderOutcome } from "@softure-ai/mailing";
import { fakeMailProvider } from "@softure-ai/mailing/testing";
import { describe, expect, it } from "vitest";

const DELIVERY: AlertDelivery = {
  channel: "mail",
  subject: "[Critical] The import stopped",
  text: "[Critical] The import stopped\nSource x answered 500.",
  message: { kind: "fired", key: "app.import", severity: "critical", title: "The import stopped", details: "Source x answered 500.", link: null, repeats: 0, occurrences: 1, at: "2026-11-02T12:00:00.000Z" },
};

function setup(respond?: () => Exclude<ProviderOutcome, { status: "sent" }>) {
  const provider = fakeMailProvider(respond === undefined ? {} : { respond });
  const channel = mailChannel({ to: "ops@example.com", sender: "alerts" });
  const config = defineSoftureConfig({
    database: { url: "pglite://" },
    locale: "en",
    timezone: "UTC",
    appOrigin: "https://app.example.com",
    modules: [
      jobs({ queues: { "alerts.deliver": {} } }),
      mailing({ from: "App <hello@mail.example.com>", senders: { alerts: "App alerts <alerts@mail.example.com>" }, provider }),
      alerts({ channels: { mail: channel } }),
    ],
  });
  return { provider, channel, config };
}

describe("mailChannel", () => {
  it("sends the subject and text from the named sender, with a stable idempotency key", async () => {
    const { provider, channel, config } = setup();
    expect(await channel.deliver(DELIVERY, { config })).toEqual({ ok: true, value: undefined });
    // A retried delivery is the same mail: the provider answers it from its idempotency key.
    expect(await channel.deliver(DELIVERY, { config })).toEqual({ ok: true, value: undefined });
    expect(provider.sent).toHaveLength(1);
    expect(provider.sent[0]).toMatchObject({ from: "App alerts <alerts@mail.example.com>", to: "ops@example.com", subject: DELIVERY.subject, text: DELIVERY.text });
    expect(provider.sent[0]?.idempotencyKey).toMatch(/^alerts-[0-9a-f]{64}$/);
  });

  it("maps an unreachable provider to unavailable and a refusal to refused", async () => {
    const down = setup(() => ({ status: "unavailable" }));
    expect(await down.channel.deliver(DELIVERY, { config: down.config })).toEqual({ ok: false, error: "alerts.channel_unavailable" });
    const refused = setup(() => ({ status: "refused", httpStatus: 401 }));
    expect(await refused.channel.deliver(DELIVERY, { config: refused.config })).toEqual({ ok: false, error: "alerts.channel_refused" });
  });

  it("is unconfigured without an address", async () => {
    const { config, provider } = setup();
    expect(await mailChannel({ to: undefined }).deliver(DELIVERY, { config })).toEqual({ ok: false, error: "alerts.channel_unconfigured" });
    expect(provider.sent).toEqual([]);
  });
});
