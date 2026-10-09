// previewMail renders exactly what sendMail hands the provider; the operator helpers mask what a terminal shows.
import { mailing, type OutgoingMail } from "@softure-ai/mailing";
import { maskAddress, previewMail, redactUnsubscribeSignatures, resolveMailKind, sendMail, suppressRecipient } from "@softure-ai/mailing/server";
import { fakeMailProvider } from "@softure-ai/mailing/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createConfig, createTestMailing, FROM, MAIL, REPLY_TO, SECRET, type TestMailing } from "./support.js";

const NEWSLETTER: OutgoingMail = { ...MAIL, kind: "newsletter", html: "<p>Hello Ada.</p>", headers: { "X-Campaign": "42" } };
const ENV = { MAILING_UNSUBSCRIBE_SECRET: SECRET };

describe("previewMail", () => {
  let test: TestMailing;

  beforeEach(async () => {
    test = await createTestMailing();
    vi.stubEnv("MAILING_UNSUBSCRIBE_SECRET", SECRET);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(async () => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    await test.database.close();
  });

  it.each([
    ["list mail", NEWSLETTER, {}],
    ["transactional mail with its own reply-to and a key", { ...MAIL, replyTo: "buyer@example.net" }, { idempotencyKey: "order-7" }],
  ])("returns exactly what sendMail hands the provider for %s", async (_case, mail, options) => {
    const provider = fakeMailProvider();
    const config = createConfig(provider);

    const preview = previewMail(config, mail, { ...options, env: ENV });
    await sendMail({ config, db: test.database.db }, mail, options);

    const { id, ...sent } = provider.sent[0] ?? { id: "" };
    void id;
    expect(preview).toEqual({ ok: true, value: sent });
  });

  it("renders the footer and headers of list mail with the configured sender and reply-to", () => {
    const preview = previewMail(test.config, NEWSLETTER, { env: ENV });

    expect(preview.ok && preview.value).toMatchObject({
      from: FROM,
      replyTo: REPLY_TO,
      text: expect.stringContaining("\n-- \nDon't want these emails? Unsubscribe here:\nhttps://app.example.com/unsubscribe?r=") as unknown,
      headers: { "X-Campaign": "42", "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
    });
  });

  it("renders a suppressed recipient's mail too: it reads no database", async () => {
    await suppressRecipient(test.ctx, MAIL.to);
    expect(previewMail(test.config, NEWSLETTER, { env: ENV }).ok).toBe(true);
  });

  it("names the invalid fields", () => {
    expect(previewMail(test.config, { ...MAIL, to: "two@example.org, three@example.org", subject: "" })).toEqual({ ok: false, error: "mailing.invalid_input", fields: ["to", "subject"] });
  });

  it("refuses list mail without the secret, and renders transactional mail without it", () => {
    expect(previewMail(test.config, NEWSLETTER, { env: {} })).toEqual({ ok: false, error: "mailing.unavailable", cause: "no_unsubscribe_secret" });
    expect(previewMail(test.config, MAIL, { env: {} }).ok).toBe(true);
  });

  it("logs nothing", () => {
    previewMail(test.config, { ...MAIL, to: "nope" });
    previewMail(test.config, NEWSLETTER, { env: {} });
    expect(console.error).not.toHaveBeenCalled();
  });
});

describe("the operator helpers", () => {
  it.each([
    ["ada@example.org", "a**@example.org"],
    ["  Ada.Lovelace@Example.org ", "A***********@Example.org"],
    ["a@example.org", "a@example.org"],
    ["not an address", "**************"],
    ["", "*"],
  ])("masks %j as %j", (address, masked) => {
    expect(maskAddress(address)).toBe(masked);
  });

  it("redacts the signature of raw and HTML-escaped links, and leaves the rest", () => {
    const key = "K".repeat(43);
    expect(redactUnsubscribeSignatures(`https://a.example/unsubscribe?r=${key}&t=SIG_1-x and <a href="/u?r=${key}&amp;t=SIG2">`)).toBe(
      `https://a.example/unsubscribe?r=${key}&t=<signature> and <a href="/u?r=${key}&amp;t=<signature>">`,
    );
  });

  it("resolves a kind alias and leaves other kinds as they are", () => {
    const config = createConfig(fakeMailProvider(), { kindAliases: { news: "newsletter" } });
    expect(resolveMailKind(config, "news")).toBe("newsletter");
    expect(resolveMailKind(config, "newsletter")).toBe("newsletter");
    expect(resolveMailKind(config, "toString")).toBe("toString");
    expect(resolveMailKind(createConfig(fakeMailProvider()), "news")).toBe("news");
  });

  it("refuses kind aliases that are not kebab-case or chain, and a test address that is not one address", () => {
    const provider = fakeMailProvider();
    expect(() => mailing({ from: FROM, provider, kindAliases: { News: "newsletter" } })).toThrow("kindAliases");
    expect(() => mailing({ from: FROM, provider, kindAliases: { news: "newsletter", newsletter: "list" } })).toThrow("must not use a kind as an alias");
    expect(() => mailing({ from: FROM, provider, testAddress: "a@example.org, b@example.org" })).toThrow("testAddress");
    expect(mailing({ from: FROM, provider, testAddress: " ops@example.com " }).options.testAddress).toBe("ops@example.com");
  });
});
