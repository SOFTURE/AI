// sendMail: every branch of the result, the boundary checks, the timeout and the log line.
import type { MailProvider, OutgoingMail, ProviderMessage, ProviderOutcome } from "@softure-ai/mailing";
import { sendMail } from "@softure-ai/mailing/server";
import { fakeMailProvider } from "@softure-ai/mailing/testing";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { createConfig, FROM, MAIL, REPLY_TO } from "./support.js";

/** A provider that answers `outcome` (or runs `send`) and records what it was given. */
function createProvider(send: (message: ProviderMessage, signal: AbortSignal) => Promise<unknown>) {
  const calls: ProviderMessage[] = [];
  const provider: MailProvider = {
    name: "stub",
    send: (message, { signal }) => {
      calls.push(message);
      return send(message, signal) as Promise<ProviderOutcome>;
    },
  };
  return { provider, calls };
}

function answer(outcome: unknown) {
  return createProvider(() => Promise.resolve(outcome));
}

describe("sendMail", () => {
  let log: MockInstance<typeof console.error>;

  beforeEach(() => {
    log = vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => {
    log.mockRestore();
    vi.useRealTimers();
  });

  /** Every log line written so far, joined. */
  const logged = () => log.mock.calls.map((call) => call.join(" ")).join("\n");

  it("hands the provider the mail with the configured sender and reply-to, and returns its id", async () => {
    const { provider, calls } = answer({ status: "sent", id: "msg_1" });
    const mail: OutgoingMail = { ...MAIL, html: "<p>Hello Ada</p>", headers: { "List-Unsubscribe": "<https://example.com/u>" } };

    await expect(sendMail({ config: createConfig(provider) }, mail, { idempotencyKey: "summary:42" })).resolves.toEqual({
      ok: true,
      value: { id: "msg_1", provider: "stub" },
    });
    expect(calls).toEqual([
      {
        from: FROM,
        to: "ada@example.org",
        replyTo: REPLY_TO,
        subject: "Your weekly summary",
        text: "Hello Ada, here is your summary.",
        html: "<p>Hello Ada</p>",
        headers: { "List-Unsubscribe": "<https://example.com/u>" },
        idempotencyKey: "summary:42",
      },
    ]);
    expect(log).not.toHaveBeenCalled();
  });

  it("sends plain text only, with no reply-to, no headers and no key, as nulls and an empty map", async () => {
    const { provider, calls } = answer({ status: "sent", id: "msg_2" });
    const result = await sendMail({ config: createConfig(provider, { replyTo: undefined }) }, { ...MAIL, to: "  ada@example.org " });
    expect(result.ok).toBe(true);
    expect(calls[0]).toEqual({ ...MAIL, from: FROM, replyTo: null, html: null, headers: {}, idempotencyKey: null });
  });

  it.each([
    ["rejected", { status: "rejected", httpStatus: 422 }, "mailing.rejected", "status=422"],
    ["unavailable", { status: "unavailable", httpStatus: 503 }, "mailing.unavailable", "status=503"],
    ["unavailable without a status", { status: "unavailable" }, "mailing.unavailable", "status=none"],
  ])("returns %s when the provider says so, and logs the status", async (_case, outcome, code, status) => {
    const { provider } = answer(outcome);
    await expect(sendMail({ config: createConfig(provider) }, MAIL)).resolves.toEqual({ ok: false, error: code });
    expect(logged()).toBe(`mailing: send failed provider=stub reason=${code.slice("mailing.".length)} ${status}`);
  });

  it.each([
    ["throws", () => Promise.reject(new Error("socket hang up ada@example.org"))],
    ["answers nothing", () => Promise.resolve(undefined)],
    ["answers an unknown status", () => Promise.resolve({ status: "queued", id: "x" })],
    ["answers sent without an id", () => Promise.resolve({ status: "sent", id: "" })],
  ])("returns unavailable when the provider %s", async (_case, send) => {
    const { provider } = createProvider(send);
    await expect(sendMail({ config: createConfig(provider) }, MAIL)).resolves.toEqual({ ok: false, error: "mailing.unavailable" });
    expect(logged()).toBe("mailing: send failed provider=stub reason=unavailable status=none");
  });

  it("returns unavailable at the timeout, aborts the provider's signal, even when the provider ignores it", async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    const { provider } = createProvider((_message, received) => {
      signal = received;
      return new Promise(() => undefined);
    });
    const sending = sendMail({ config: createConfig(provider, { timeoutMs: 2_000 }) }, MAIL);
    await vi.advanceTimersByTimeAsync(1_999);
    expect(signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await expect(sending).resolves.toEqual({ ok: false, error: "mailing.unavailable" });
    expect(signal?.aborted).toBe(true);
  });

  it("clears its timer after an answer", async () => {
    vi.useFakeTimers();
    const { provider } = answer({ status: "sent", id: "msg_3" });
    await sendMail({ config: createConfig(provider) }, MAIL);
    expect(vi.getTimerCount()).toBe(0);
  });

  describe("refuses invalid input before the provider is called", () => {
    const invalid: [string, unknown, unknown, string][] = [
      ["two recipients", { ...MAIL, to: "ada@example.org, eve@example.org" }, {}, "to"],
      ["a recipient list", { ...MAIL, to: "ada@example.org;eve@example.org" }, {}, "to"],
      ["a recipient without a domain", { ...MAIL, to: "ada" }, {}, "to"],
      ["a named recipient", { ...MAIL, to: "Ada <ada@example.org>" }, {}, "to"],
      ["a recipient with an empty domain label", { ...MAIL, to: "ada@example..org" }, {}, "to"],
      ["a recipient over 254 characters", { ...MAIL, to: `${"a".repeat(250)}@example.org` }, {}, "to"],
      ["an empty subject", { ...MAIL, subject: "  " }, {}, "subject"],
      ["a subject with a line break", { ...MAIL, subject: "Hi\r\nBcc: eve@example.org" }, {}, "subject"],
      ["a subject over 998 characters", { ...MAIL, subject: "x".repeat(999) }, {}, "subject"],
      ["an empty text", { ...MAIL, text: " \n " }, {}, "text"],
      ["an empty html", { ...MAIL, html: "" }, {}, "html"],
      ["a Bcc header", { ...MAIL, headers: { Bcc: "eve@example.org" } }, {}, "headers"],
      ["a From header in any case", { ...MAIL, headers: { fROM: "eve@example.org" } }, {}, "headers"],
      ["a Content-Type header", { ...MAIL, headers: { "Content-Type": "text/plain" } }, {}, "headers"],
      ["a header value with a line break", { ...MAIL, headers: { "X-Tag": "a\r\nBcc: eve@example.org" } }, {}, "headers"],
      ["a header name with a colon", { ...MAIL, headers: { "X:Tag": "a" } }, {}, "headers"],
      ["a header name with a space", { ...MAIL, headers: { "X Tag": "a" } }, {}, "headers"],
      ["an empty idempotency key", MAIL, { idempotencyKey: "" }, "idempotencyKey"],
      ["an idempotency key with a space", MAIL, { idempotencyKey: "a b" }, "idempotencyKey"],
      ["an idempotency key over 256 characters", MAIL, { idempotencyKey: "k".repeat(257) }, "idempotencyKey"],
      ["a mail that is not an object", null, {}, "mail"],
    ];

    it.each(invalid)("%s", async (_case, mail, options, field) => {
      const { provider, calls } = answer({ status: "sent", id: "never" });
      await expect(sendMail({ config: createConfig(provider) }, mail as OutgoingMail, options as { idempotencyKey?: string })).resolves.toEqual({
        ok: false,
        error: "mailing.invalid_input",
      });
      expect(calls).toEqual([]);
      expect(logged()).toBe(`mailing: send failed provider=stub reason=invalid_input status=none fields=${field}`);
    });

    it("names every failing field once", async () => {
      const { provider } = answer({ status: "sent", id: "never" });
      await sendMail({ config: createConfig(provider) }, { to: "", subject: "", text: "" }, { idempotencyKey: "" });
      expect(logged()).toBe("mailing: send failed provider=stub reason=invalid_input status=none fields=to,subject,text,idempotencyKey");
    });
  });

  it("accepts the longest subject and key, and a header with a dash", async () => {
    const { provider } = answer({ status: "sent", id: "msg_4" });
    const result = await sendMail(
      { config: createConfig(provider) },
      { ...MAIL, subject: "x".repeat(998), headers: { "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } },
      { idempotencyKey: "k".repeat(256) },
    );
    expect(result.ok).toBe(true);
  });

  it("checks a long hostile address quickly (no polynomial backtracking)", async () => {
    const { provider } = answer({ status: "sent", id: "never" });
    const started = performance.now();
    await sendMail({ config: createConfig(provider) }, { ...MAIL, to: `!@!.${"!.".repeat(50_000)}` });
    expect(performance.now() - started).toBeLessThan(500);
  });

  it("never writes the address, subject, body or key to the log", async () => {
    const { provider } = createProvider(() => Promise.reject(new Error(`refused ${MAIL.to} ${MAIL.subject}`)));
    await sendMail({ config: createConfig(provider) }, { ...MAIL, html: "<b>secret body</b>" }, { idempotencyKey: "key-ada" });
    await sendMail({ config: createConfig(provider) }, { ...MAIL, headers: { Bcc: "eve@example.org" } }, { idempotencyKey: "key-ada" });
    for (const secret of [MAIL.to, MAIL.subject, MAIL.text, "secret body", "key-ada", "eve@example.org"]) {
      expect(logged()).not.toContain(secret);
    }
  });

  it("works with the fake provider end to end", async () => {
    const provider = fakeMailProvider();
    const result = await sendMail({ config: createConfig(provider) }, MAIL);
    expect(result).toEqual({ ok: true, value: { id: provider.sent[0]?.id, provider: "fake" } });
  });
});
