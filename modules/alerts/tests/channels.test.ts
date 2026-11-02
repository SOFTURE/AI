// The webhook channels: the request each one sends, and how answers map to channel codes.
import { discordChannel, slackChannel, telegramChannel, webhookChannel, type AlertDelivery } from "@softure-ai/alerts";
import type { FetchFunction, SoftureConfig } from "@softure-ai/core";
import { describe, expect, it } from "vitest";

const DELIVERY: AlertDelivery = {
  channel: "ops",
  subject: "[Critical] Schedule app.sync is failing",
  text: "[Critical] Schedule app.sync is failing\nLast failure: app.timeout.",
  message: {
    kind: "fired",
    key: "jobs.schedule:app.sync",
    severity: "critical",
    title: "Schedule app.sync is failing",
    details: "Last failure: app.timeout.",
    link: null,
    repeats: 0,
    occurrences: 1,
    at: "2026-11-02T12:00:00.000Z",
  },
};
// The webhook channels never read the config.
const CONTEXT = { config: {} as SoftureConfig };

interface Captured {
  readonly url: string;
  readonly init: RequestInit;
}

function fakeFetch(response: () => Response): { fetch: FetchFunction; calls: Captured[] } {
  const calls: Captured[] = [];
  return {
    calls,
    fetch: (input, init) => {
      calls.push({ url: String(input), init });
      return Promise.resolve(response());
    },
  };
}

function bodyOf(call: Captured | undefined): unknown {
  return JSON.parse(call?.init.body as string);
}

describe("slackChannel", () => {
  it("posts the text and accepts Slack's plain ok answer", async () => {
    const fake = fakeFetch(() => new Response("ok", { status: 200, headers: { "content-type": "text/plain" } }));
    const channel = slackChannel({ url: "https://hooks.slack.com/services/T/B/X", fetch: fake.fetch });
    expect(await channel.deliver(DELIVERY, CONTEXT)).toEqual({ ok: true, value: undefined });
    expect(fake.calls[0]?.url).toBe("https://hooks.slack.com/services/T/B/X");
    expect(fake.calls[0]?.init.method).toBe("POST");
    expect(bodyOf(fake.calls[0])).toEqual({ text: DELIVERY.text });
  });
});

describe("discordChannel", () => {
  it("posts the content without mentions, cut to 2000 characters", async () => {
    const fake = fakeFetch(() => new Response(null, { status: 204 }));
    const channel = discordChannel({ url: "https://discord.com/api/webhooks/1/x", fetch: fake.fetch });
    const long = { ...DELIVERY, text: "x".repeat(2500) };
    expect(await channel.deliver(long, CONTEXT)).toEqual({ ok: true, value: undefined });
    const body = bodyOf(fake.calls[0]) as { content: string; allowed_mentions: unknown };
    expect(body.content).toHaveLength(2000);
    expect(body.content.endsWith("…")).toBe(true);
    expect(body.allowed_mentions).toEqual({ parse: [] });
  });
});

describe("telegramChannel", () => {
  it("calls sendMessage of the bot with the chat id and plain text", async () => {
    const fake = fakeFetch(() => Response.json({ ok: true, result: {} }));
    const channel = telegramChannel({ botToken: "123:abc", chatId: "-1001", fetch: fake.fetch });
    expect(await channel.deliver(DELIVERY, CONTEXT)).toEqual({ ok: true, value: undefined });
    expect(fake.calls[0]?.url).toBe("https://api.telegram.org/bot123:abc/sendMessage");
    expect(bodyOf(fake.calls[0])).toEqual({ chat_id: "-1001", text: DELIVERY.text, disable_web_page_preview: true });
  });

  it("is unconfigured without a token or a chat", async () => {
    const fake = fakeFetch(() => Response.json({}));
    expect(await telegramChannel({ botToken: undefined, chatId: "1", fetch: fake.fetch }).deliver(DELIVERY, CONTEXT)).toEqual({ ok: false, error: "alerts.channel_unconfigured" });
    expect(await telegramChannel({ botToken: "1:a", chatId: "", fetch: fake.fetch }).deliver(DELIVERY, CONTEXT)).toEqual({ ok: false, error: "alerts.channel_unconfigured" });
    expect(fake.calls).toEqual([]);
  });
});

describe("webhookChannel", () => {
  it("posts the message's fields with the channel, subject, text and the app's headers", async () => {
    const fake = fakeFetch(() => Response.json({ received: true }));
    const channel = webhookChannel({ url: "https://ops.example.com/hook", headers: { authorization: "Bearer t" }, fetch: fake.fetch });
    expect(await channel.deliver(DELIVERY, CONTEXT)).toEqual({ ok: true, value: undefined });
    expect(bodyOf(fake.calls[0])).toEqual({ ...DELIVERY.message, channel: "ops", subject: DELIVERY.subject, text: DELIVERY.text });
    expect(new Headers(fake.calls[0]?.init.headers).get("authorization")).toBe("Bearer t");
  });
});

describe("answers", () => {
  const cases: [string, () => Response, unknown][] = [
    ["a 429 with Retry-After", () => new Response("slow down", { status: 429, headers: { "retry-after": "30" } }), { ok: false, error: "alerts.channel_rate_limited", retryAfterSeconds: 30 }],
    ["a 429 without Retry-After", () => new Response("", { status: 429 }), { ok: false, error: "alerts.channel_rate_limited" }],
    ["a 503", () => new Response("", { status: 503 }), { ok: false, error: "alerts.channel_unavailable" }],
    ["a 403", () => new Response("", { status: 403 }), { ok: false, error: "alerts.channel_refused" }],
    ["a 404 (a deleted webhook)", () => new Response("", { status: 404 }), { ok: false, error: "alerts.channel_refused" }],
    ["a redirect", () => new Response("", { status: 302, headers: { location: "https://elsewhere.example.com" } }), { ok: false, error: "alerts.channel_refused" }],
  ];

  it.each(cases)("maps %s", async (_name, response, expected) => {
    const channel = webhookChannel({ url: "https://ops.example.com/hook", fetch: fakeFetch(response).fetch });
    expect(await channel.deliver(DELIVERY, CONTEXT)).toEqual(expected);
  });

  it("maps a network failure to unavailable", async () => {
    const channel = slackChannel({ url: "https://hooks.slack.com/services/x", fetch: () => Promise.reject(new TypeError("fetch failed")) });
    expect(await channel.deliver(DELIVERY, CONTEXT)).toEqual({ ok: false, error: "alerts.channel_unavailable" });
  });

  it("is unconfigured without a URL and sends nothing", async () => {
    const fake = fakeFetch(() => new Response("ok"));
    for (const channel of [slackChannel({ url: undefined, fetch: fake.fetch }), discordChannel({ url: "", fetch: fake.fetch }), webhookChannel({ url: undefined, fetch: fake.fetch })]) {
      expect(await channel.deliver(DELIVERY, CONTEXT)).toEqual({ ok: false, error: "alerts.channel_unconfigured" });
    }
    expect(fake.calls).toEqual([]);
  });
});
