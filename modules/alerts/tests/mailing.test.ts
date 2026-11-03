// The mail channel: a transactional mail from the named sender through mailing's provider, its idempotency key, and
// the mapping of mailing's codes.
import { alerts, type AlertDelivery } from "@softure-ai/alerts";
import { getAlertIdempotencyKey, mailChannel, parseAlertDetails, renderAlertMailHtml, toMailChannelResult } from "@softure-ai/alerts/mailing";
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

// A delivery as renderAlert builds it, with parts.
const RENDERED: AlertDelivery = {
  channel: "mail",
  subject: "[Critical] Import <x> & stop",
  text: "[Critical] Import <x> & stop\n- Change \"a\"\n  line one\n  line two\n- Change b\nHappened 3 more times since the last message.\nOpen: https://app.example.com/admin?a=1&b=2",
  message: { kind: "fired", key: "app.import", severity: "critical", title: "Import <x> & stop", details: "- Change \"a\"\n  line one\n  line two\n- Change b", link: "https://app.example.com/admin?a=1&b=2", repeats: 3, occurrences: 4, at: "2026-11-02T12:00:00.000Z" },
  parts: {
    tag: "Critical",
    title: "Import <x> & stop",
    details: "- Change \"a\"\n  line one\n  line two\n- Change b",
    repeats: "Happened 3 more times since the last message.",
    link: { label: "Open", url: "https://app.example.com/admin?a=1&b=2" },
  },
};

function setup(respond?: () => Exclude<ProviderOutcome, { status: "sent" }>, options: Partial<Parameters<typeof mailChannel>[0]> = {}) {
  const provider = fakeMailProvider(respond === undefined ? {} : { respond });
  const channel = mailChannel({ to: "ops@example.com", sender: "alerts", ...options });
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
    expect(provider.sent[0]?.idempotencyKey).toBe(getAlertIdempotencyKey(DELIVERY));
  });

  it("sends a hand-built delivery without parts as text only", async () => {
    const { provider, channel, config } = setup();
    await channel.deliver(DELIVERY, { config });
    expect(provider.sent[0]?.html).toBeNull();
  });

  it("adds the default HTML part next to the unchanged text", async () => {
    const { provider, channel, config } = setup();
    await channel.deliver(RENDERED, { config });
    expect(provider.sent[0]?.text).toBe(RENDERED.text);
    expect(provider.sent[0]?.html).toBe(renderAlertMailHtml(RENDERED));
  });

  it("takes the app's own HTML or none", async () => {
    const own = setup(undefined, { html: (delivery) => `<p>${delivery.message.key}</p>` });
    await own.channel.deliver(RENDERED, { config: own.config });
    expect(own.provider.sent[0]?.html).toBe("<p>app.import</p>");
    const none = setup(undefined, { html: () => undefined });
    await none.channel.deliver(RENDERED, { config: none.config });
    expect(none.provider.sent[0]?.html).toBeNull();
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

describe("renderAlertMailHtml", () => {
  it("renders the badge, title, details list, repeats line and link button, every value escaped", () => {
    const html = renderAlertMailHtml(RENDERED) ?? "";
    expect(html).toContain("max-width:600px");
    expect(html).toContain("background:#fde2e2;color:#b91c1c;font-size:12px;font-weight:600\">Critical</span>");
    expect(html).toContain(">Import &lt;x&gt; &amp; stop</h1>");
    expect(html).toContain("<title>[Critical] Import &lt;x&gt; &amp; stop</title>");
    expect(html).toContain(
      '<ul style="margin:0 0 16px;padding-left:20px"><li style="margin:0 0 8px">Change &quot;a&quot;<br><span style="color:#6b7280;font-size:14px">line one</span><br><span style="color:#6b7280;font-size:14px">line two</span></li><li style="margin:0 0 8px">Change b</li></ul>',
    );
    expect(html).toContain(">Happened 3 more times since the last message.</p>");
    expect(html).toContain('<a href="https://app.example.com/admin?a=1&amp;b=2"');
    expect(html).toContain(">Open</a>");
    expect(html).not.toContain("<x>");
  });

  it("gives a recovery a green badge and leaves out what the message lacks", () => {
    const resolved: AlertDelivery = {
      ...RENDERED,
      message: { ...RENDERED.message, kind: "resolved", details: null, link: null, repeats: 0 },
      parts: { tag: "Resolved", title: "Import", details: null, repeats: null, link: null },
    };
    const html = renderAlertMailHtml(resolved) ?? "";
    expect(html).toContain("background:#dcfce7;color:#15803d;font-size:12px;font-weight:600\">Resolved</span>");
    expect(html).not.toContain("<ul");
    expect(html).not.toContain("<a ");
    expect(html).not.toContain("more times");
  });

  it("is undefined for a delivery without parts", () => {
    expect(renderAlertMailHtml(DELIVERY)).toBeUndefined();
  });
});

describe("parseAlertDetails", () => {
  it("reads list items with indented sub-lines and paragraphs around them", () => {
    expect(parseAlertDetails("Two changes:\n- a\n\tfirst\n- b\n\nDone.")).toEqual([
      { kind: "paragraph", text: "Two changes:" },
      { kind: "list", items: [{ text: "a", lines: ["first"] }, { text: "b", lines: [] }] },
      { kind: "paragraph", text: "Done." },
    ]);
  });

  it("keeps plain details as one paragraph per line and ignores empty input", () => {
    expect(parseAlertDetails("Source x answered 500.")).toEqual([{ kind: "paragraph", text: "Source x answered 500." }]);
    expect(parseAlertDetails("")).toEqual([]);
  });
});

describe("toMailChannelResult", () => {
  it("keeps the wait of an unavailable or limited provider and makes a refusal final", () => {
    expect(toMailChannelResult("mailing.unavailable", 30)).toEqual({ ok: false, error: "alerts.channel_unavailable", retryAfterSeconds: 30 });
    expect(toMailChannelResult("mailing.quota_exceeded", undefined)).toEqual({ ok: false, error: "alerts.channel_rate_limited" });
    expect(toMailChannelResult("mailing.suppressed", undefined)).toEqual({ ok: false, error: "alerts.channel_refused" });
  });
});
