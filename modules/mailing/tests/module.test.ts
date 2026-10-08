// The module definition: its manifest and the options an app passes in softure.config.ts.
import { readFileSync } from "node:fs";
import { defineSoftureConfig, toModuleJson } from "@softure-ai/core";
import { DEFAULT_TIMEOUT_MS, mailing, resend } from "@softure-ai/mailing";
import { getMailingOptions } from "@softure-ai/mailing/server";
import { fakeMailProvider } from "@softure-ai/mailing/testing";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestMailing, FROM, NOW, REPLY_TO, type TestMailing } from "./support.js";

describe("the mailing module", () => {
  it("ships a module.json equal to its manifest", () => {
    const moduleJson: unknown = JSON.parse(readFileSync(new URL("../module.json", import.meta.url), "utf8"));
    expect(moduleJson).toEqual(toModuleJson(mailing));
  });

  it("keeps the package version and the manifest version in step", () => {
    const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string };
    expect(mailing.manifest.version).toBe(manifest.version);
  });

  it("keeps its suppression list, campaigns and delivery ledger in the mailing schema and needs no other module", () => {
    expect(mailing.manifest.dbSchema).toBe("mailing");
    expect(mailing.manifest.tables).toEqual(["suppressions", "campaigns", "deliveries"]);
    expect(mailing.manifest.dependsOn).toEqual({});
  });

  it("needs a database, which keeps the suppression list", () => {
    expect(() =>
      defineSoftureConfig({ locale: "en", timezone: "UTC", appOrigin: "http://localhost:3000", modules: [mailing({ from: FROM, provider: fakeMailProvider() })] }),
    ).toThrow('database: required because module "mailing" has a database schema');
  });

  it("mounts the unsubscribe page at /unsubscribe and the one-click route at /api/mailing/unsubscribe, both overridable", () => {
    expect(mailing({ from: FROM, provider: fakeMailProvider() }).routes).toEqual({ unsubscribe: "/unsubscribe", oneClick: "/api/mailing/unsubscribe" });
    expect(mailing({ from: FROM, provider: fakeMailProvider(), routes: { unsubscribe: "/opt-out" } }).routes.unsubscribe).toBe("/opt-out");
  });

  it("keeps the options it was given and defaults the timeout to ten seconds, the claim windows to 15 minutes and 23 hours, and attempts to 5", () => {
    const provider = resend({ apiKey: "re_test" });
    expect(mailing({ from: FROM, replyTo: REPLY_TO, provider }).options).toEqual({
      from: FROM,
      replyTo: REPLY_TO,
      provider,
      timeoutMs: 10_000,
      staleClaimMs: 15 * 60_000,
      uncertainClaimMs: 23 * 3_600_000,
      maxAttempts: 5,
    });
    expect(DEFAULT_TIMEOUT_MS).toBe(10_000);
  });

  it("accepts a bare address as the sender and no reply-to", () => {
    const options = mailing({ from: "hello@mail.example.com", provider: fakeMailProvider() }).options;
    expect(options.from).toBe("hello@mail.example.com");
    expect(options.replyTo).toBeUndefined();
  });

  it("refuses options it cannot send with, listing every problem", () => {
    expect(() =>
      mailing({
        from: "Example <hello@example.com>, eve@example.com",
        replyTo: "a@example.com; b@example.com",
        // @ts-expect-error: a JavaScript config can pass something that is not a provider.
        provider: { send: "nope" },
        timeoutMs: 500,
      }),
    ).toThrow(
      [
        'Invalid SOFTURE configuration in module "mailing":',
        "- options.from: must be an address or Name <address>, e.g. Plan <hello@example.com>",
        "- options.replyTo: must be one address, e.g. support@example.com",
        "- options.provider: must be a mail provider such as resend()",
        "- options.timeoutMs: Too small: expected number to be >=1000",
      ].join("\n"),
    );
  });

  it.each([
    ["a sender with a line break", "Example <hello@example.com>\r\nBcc: eve@example.com"],
    ["a sender without a domain", "hello"],
    ["a display name without an address", "Example <>"],
    ["a display name with a comma", "Doe, John <hello@example.com>"],
    ["a quoted display name", '"Doe" <hello@example.com>'],
    ["an address without a display name in brackets", "<hello@example.com>"],
    ["an address over 254 characters", `${"a".repeat(250)}@example.com`],
  ])("refuses %s", (_case, from) => {
    expect(() => mailing({ from, provider: fakeMailProvider() })).toThrow("options.from");
  });

  it.each([
    ["an uncertain window not above the stale one", { staleClaimMs: 3_600_000, uncertainClaimMs: 3_600_000 }, "options.uncertainClaimMs: must be more than staleClaimMs"],
    ["a stale window under a minute", { staleClaimMs: 1_000 }, "options.staleClaimMs"],
    ["an uncertain window over 30 days", { uncertainClaimMs: 31 * 24 * 3_600_000 }, "options.uncertainClaimMs"],
    ["no attempts", { maxAttempts: 0 }, "options.maxAttempts"],
    ["more than 100 attempts", { maxAttempts: 101 }, "options.maxAttempts"],
    ["a fractional attempt count", { maxAttempts: 2.5 }, "options.maxAttempts"],
  ])("refuses %s", (_case, windows, message) => {
    expect(() => mailing({ from: FROM, provider: fakeMailProvider(), ...windows })).toThrow(message);
  });

  it.each([
    ["the signed link's recipient name", ["r", "t"], "must not use r or status"],
    ["the page's status name", ["u", "status"], "must not use r or status"],
    ["a repeated name", ["u", "u"], "must not repeat a name"],
    ["a name with a space", ["u id"], "must be a query name"],
    ["no names", [], "options.legacyUnsubscribe.params"],
    ["nine names", ["a", "b", "c", "d", "e", "f", "g", "h", "i"], "options.legacyUnsubscribe.params"],
  ])("refuses legacy unsubscribe params with %s", (_case, params, message) => {
    expect(() => mailing({ from: FROM, provider: fakeMailProvider(), legacyUnsubscribe: { params, verify: () => Promise.resolve(null) } })).toThrow(message);
  });

  it("accepts legacy unsubscribe params that share the signature's name", () => {
    expect(() => mailing({ from: FROM, provider: fakeMailProvider(), legacyUnsubscribe: { params: ["u", "t"], verify: () => Promise.resolve(null) } })).not.toThrow();
  });

  it("accepts maxAttempts null, which never closes a delivery on unavailable", () => {
    expect(mailing({ from: FROM, provider: fakeMailProvider(), maxAttempts: null }).options).toMatchObject({ maxAttempts: null });
  });

  it("refuses a recipient source that is not a function", () => {
    expect(() => mailing({ from: FROM, provider: fakeMailProvider(), listCampaignRecipients: ["ada@example.org"] as never })).toThrow("options.listCampaignRecipients");
  });

  it("refuses an unknown option, so a typo does not go unnoticed", () => {
    // @ts-expect-error: `replyto` is not an option.
    expect(() => mailing({ from: FROM, provider: fakeMailProvider(), replyto: REPLY_TO })).toThrow('options: Unrecognized key: "replyto"');
  });

  it("reads its options from a configuration and fails loudly when the app did not enable it", () => {
    const provider = fakeMailProvider();
    const config = defineSoftureConfig({
      database: { url: "pglite://" },
      locale: "en",
      timezone: "UTC",
      appOrigin: "http://localhost:3000",
      modules: [mailing({ from: FROM, provider })],
    });
    expect(getMailingOptions(config).provider).toBe(provider);
    const empty = defineSoftureConfig({ locale: "en", timezone: "UTC", appOrigin: "http://localhost:3000", modules: [] });
    expect(() => getMailingOptions(empty)).toThrow("@softure-ai/mailing: the module is not enabled");
  });
});

describe("the suppressions table", () => {
  let test: TestMailing;

  beforeEach(async () => {
    test = await createTestMailing();
  });
  afterEach(async () => {
    await test.database.close();
  });

  const KEY = "a".repeat(43);
  const insert = (recipientKey: string, source = "page") =>
    test.database.client.query("INSERT INTO mailing.suppressions (recipient_key, source, created_at) VALUES ($1, $2, $3)", [recipientKey, source, NOW]);

  it.each(["one-click", "page", "operator"])("accepts a recipient key with the source %s", async (source) => {
    await expect(insert("Az09_-".padEnd(43, "x"), source)).resolves.toBeDefined();
  });

  it.each([
    ["a key of 42 characters", "a".repeat(42), "page"],
    ["a key of 44 characters", "a".repeat(44), "page"],
    ["a key with padding", `${"a".repeat(42)}=`, "page"],
    ["a plain address", "ada@example.org".padEnd(43, "x"), "page"],
    ["an unknown source", KEY, "webhook"],
  ])("rejects %s", async (_case, recipientKey, source) => {
    await expect(insert(recipientKey, source)).rejects.toThrow(/check constraint/);
  });

  it("keeps one row per recipient", async () => {
    await insert(KEY);
    await expect(insert(KEY, "one-click")).rejects.toThrow(/duplicate key/);
  });
});

describe("the mailing health check", () => {
  it("passes once the tables exist", async () => {
    const test = await createTestMailing();
    try {
      expect(await mailing({ from: FROM, provider: fakeMailProvider() }).health?.(test.ctx)).toEqual({ ok: true, value: undefined });
    } finally {
      await test.database.close();
    }
  });

  it.each(["suppressions", "deliveries", "campaigns"])("throws without mailing.%s", async (table) => {
    const test = await createTestMailing();
    try {
      await test.database.client.query(`DROP TABLE mailing.${table} CASCADE`);
      await expect(mailing({ from: FROM, provider: fakeMailProvider() }).health?.(test.ctx)).rejects.toThrow(new RegExp(`mailing\\.${table}`));
    } finally {
      await test.database.close();
    }
  });
});
