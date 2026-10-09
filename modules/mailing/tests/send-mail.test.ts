// sendMail: every branch of the result, the boundary checks, the timeout and the log line.
import { mailingMessages, type MailProvider, type OutgoingMail, type ProviderMessage, type ProviderOutcome } from "@softure-ai/mailing";
import { getRecipientKey, sendMail, signRecipientKey, suppressRecipient } from "@softure-ai/mailing/server";
import { fakeMailProvider } from "@softure-ai/mailing/testing";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { createConfig, createTestMailing, FROM, MAIL, REPLY_TO, SECRET, type TestMailing } from "./support.js";

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

  it("sends the mail's own reply-to instead of the configured one, trimmed", async () => {
    const { provider, calls } = answer({ status: "sent", id: "msg_3" });
    const result = await sendMail({ config: createConfig(provider) }, { ...MAIL, replyTo: " buyer@example.net " });
    expect(result.ok).toBe(true);
    expect(calls[0]?.replyTo).toBe("buyer@example.net");
  });

  it("sends the mail's own reply-to when the config has none", async () => {
    const { provider, calls } = answer({ status: "sent", id: "msg_3" });
    await sendMail({ config: createConfig(provider, { replyTo: undefined }) }, { ...MAIL, replyTo: "buyer@example.net" });
    expect(calls[0]?.replyTo).toBe("buyer@example.net");
  });

  it.each([
    ["rejected", { status: "rejected", httpStatus: 422 }, "mailing.rejected", "status=422"],
    ["unavailable", { status: "unavailable", httpStatus: 503 }, "mailing.unavailable", "status=503"],
    ["unavailable without a status", { status: "unavailable" }, "mailing.unavailable", "status=none"],
    ["provider_refused", { status: "refused", httpStatus: 401 }, "mailing.provider_refused", "status=401"],
    ["quota_exceeded", { status: "quota_exceeded", httpStatus: 429 }, "mailing.quota_exceeded", "status=429"],
    ["provider_refused without a status", { status: "refused" }, "mailing.provider_refused", "status=none"],
  ])("returns %s when the provider says so, with its status, and logs the status", async (_case, outcome, code, status) => {
    const { provider } = answer(outcome);
    const httpStatus = "httpStatus" in outcome ? { httpStatus: outcome.httpStatus } : {};
    await expect(sendMail({ config: createConfig(provider) }, MAIL)).resolves.toStrictEqual({ ok: false, error: code, ...httpStatus });
    expect(logged()).toBe(`mailing: send failed provider=stub reason=${code.slice("mailing.".length)} ${status}`);
  });

  it.each([
    ["throws", () => Promise.reject(new Error("socket hang up ada@example.org"))],
    ["answers nothing", () => Promise.resolve(undefined)],
    ["answers an unknown status", () => Promise.resolve({ status: "queued", id: "x" })],
    ["answers sent without an id", () => Promise.resolve({ status: "sent", id: "" })],
    ["answers an inherited status name", () => Promise.resolve({ status: "toString" })],
  ])("returns unavailable when the provider %s", async (_case, send) => {
    const { provider } = createProvider(send);
    await expect(sendMail({ config: createConfig(provider) }, MAIL)).resolves.toStrictEqual({ ok: false, error: "mailing.unavailable" });
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
      ["two reply-to addresses", { ...MAIL, replyTo: "ada@example.org, eve@example.org" }, {}, "replyTo"],
      ["a named reply-to", { ...MAIL, replyTo: "Ada <ada@example.org>" }, {}, "replyTo"],
      ["a reply-to with a line break", { ...MAIL, replyTo: "ada@example.org\r\nBcc: eve@example.org" }, {}, "replyTo"],
      ["an empty reply-to", { ...MAIL, replyTo: " " }, {}, "replyTo"],
      ["a Reply-To header", { ...MAIL, headers: { "Reply-To": "eve@example.org" } }, {}, "headers"],
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
      ["an empty kind", { ...MAIL, kind: "" }, {}, "kind"],
      ["an uppercase kind", { ...MAIL, kind: "Newsletter" }, {}, "kind"],
      ["a kind over 64 characters", { ...MAIL, kind: "k".repeat(65) }, {}, "kind"],
      ["a list mail with its own List-Unsubscribe", { ...MAIL, kind: "newsletter", headers: { "list-unsubscribe": "<https://evil.example>" } }, {}, "headers"],
      ["a list mail with its own List-Unsubscribe-Post", { ...MAIL, kind: "newsletter", headers: { "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } }, {}, "headers"],
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

describe("sendMail for list mail", () => {
  const KEY = getRecipientKey("ada@example.org");
  const QUERY = `r=${KEY}&t=${signRecipientKey(KEY, SECRET)}`;
  const PAGE = `https://app.example.com/unsubscribe?${QUERY}`;
  const ONE_CLICK = `https://app.example.com/api/mailing/unsubscribe?${QUERY}`;
  const NEWSLETTER: OutgoingMail = { ...MAIL, kind: "newsletter" };

  let test: TestMailing;
  let log: MockInstance<typeof console.error>;

  beforeEach(async () => {
    test = await createTestMailing();
    vi.stubEnv("MAILING_UNSUBSCRIBE_SECRET", SECRET);
    log = vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(async () => {
    await test.database.close();
    vi.unstubAllEnvs();
    log.mockRestore();
  });

  const logged = () => log.mock.calls.map((call) => call.join(" ")).join("\n");

  function send(mail: OutgoingMail, provider: MailProvider, options: { locale?: "en" | "pl" } = {}) {
    return sendMail({ config: createConfig(provider, options), db: test.database.db }, mail);
  }

  it("adds the footer to both bodies and the RFC 8058 headers next to the mail's own", async () => {
    const provider = fakeMailProvider();
    const result = await send({ ...NEWSLETTER, html: "<p>Hello Ada.</p>", headers: { "X-Campaign": "42" } }, provider);
    expect(result.ok).toBe(true);
    expect(provider.sent[0]).toMatchObject({
      to: "ada@example.org",
      text: ["Hello Ada, here is your summary.", "", "-- ", "Don't want these emails? Unsubscribe here:", PAGE].join("\n"),
      html: `<p>Hello Ada.</p>\n<p>Don't want these emails? <a href="${PAGE.replaceAll("&", "&amp;")}">Unsubscribe</a></p>`,
      headers: { "X-Campaign": "42", "List-Unsubscribe": `<${ONE_CLICK}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
    });
    expect(log).not.toHaveBeenCalled();
  });

  it("writes the footer in the app's locale", async () => {
    const provider = fakeMailProvider();
    await send(NEWSLETTER, provider, { locale: "pl" });
    expect(provider.sent[0]?.text).toContain(mailingMessages.pl.footer.text);
  });

  it("leaves transactional mail as it was, even to a suppressed recipient and without a secret", async () => {
    await suppressRecipient(test.ctx, "ada@example.org");
    vi.stubEnv("MAILING_UNSUBSCRIBE_SECRET", "");
    const provider = fakeMailProvider();
    expect((await send({ ...MAIL, kind: "transactional" }, provider)).ok).toBe(true);
    expect((await send(MAIL, provider)).ok).toBe(true);
    expect(provider.sent.map((mail) => [mail.text, mail.headers])).toEqual([
      [MAIL.text, {}],
      [MAIL.text, {}],
    ]);
  });

  it("refuses a recipient who unsubscribed, in any spelling, and sends nothing", async () => {
    await suppressRecipient(test.ctx, "ADA@example.org");
    const provider = fakeMailProvider();
    expect(await send({ ...NEWSLETTER, to: "Ada@Example.org" }, provider)).toEqual({ ok: false, error: "mailing.suppressed" });
    expect(await send({ ...NEWSLETTER, kind: "product-updates" }, provider)).toEqual({ ok: false, error: "mailing.suppressed" });
    expect(provider.sent).toEqual([]);
    expect(logged()).toBe(
      ["mailing: send failed provider=fake reason=suppressed status=none cause=unsubscribed", "mailing: send failed provider=fake reason=suppressed status=none cause=unsubscribed"].join("\n"),
    );
  });

  it("sends nothing without the secret, and says which variable is missing", async () => {
    vi.stubEnv("MAILING_UNSUBSCRIBE_SECRET", SECRET.slice(1));
    const provider = fakeMailProvider();
    expect(await send(NEWSLETTER, provider)).toEqual({ ok: false, error: "mailing.unavailable" });
    expect(provider.sent).toEqual([]);
    expect(logged()).toBe(
      [
        "mailing: list mail needs MAILING_UNSUBSCRIBE_SECRET (at least 32 characters) to sign unsubscribe links",
        "mailing: send failed provider=fake reason=unavailable status=none cause=no_unsubscribe_secret",
      ].join("\n"),
    );
  });

  it("sends nothing when the suppression list cannot be read, and logs no query", async () => {
    await test.database.client.query("DROP TABLE mailing.suppressions CASCADE");
    const provider = fakeMailProvider();
    expect(await send(NEWSLETTER, provider)).toEqual({ ok: false, error: "mailing.unavailable" });
    expect(provider.sent).toEqual([]);
    expect(logged()).toBe("mailing: send failed provider=fake reason=unavailable status=none cause=suppressions_unreadable");
  });

  it("never logs the address or the link", async () => {
    await suppressRecipient(test.ctx, "ada@example.org");
    await send(NEWSLETTER, fakeMailProvider());
    expect(logged()).not.toMatch(/ada|example\.org|unsubscribe\?/);
  });

  it("throws for list mail without the database handle: that is a wiring bug", async () => {
    await expect(sendMail({ config: createConfig(fakeMailProvider()) }, NEWSLETTER)).rejects.toThrow(
      "@softure-ai/mailing: list mail needs the database handle; call sendMail({ config, db }, ...)",
    );
  });
});
