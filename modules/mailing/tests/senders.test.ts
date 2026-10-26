// Named senders: a mail picks one of `mailing({ senders })` by name, never by address; an unknown name sends nothing.
import { mailing, type MailProvider, type OutgoingMail, type ProviderMessage } from "@softure-ai/mailing";
import { deliverOnce, previewMail, runDeliveries, sendMail, validateMail } from "@softure-ai/mailing/server";
import { fakeMailProvider } from "@softure-ai/mailing/testing";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { createConfig, createTestMailing, FROM, MAIL, REPLY_TO, type TestMailing } from "./support.js";

const ALERTS = "App alerts <alerts@mail.example.com>";
const CLIENTS = "App <hello@clients.example.net>";
const SENDERS = { alerts: ALERTS, clientMail: CLIENTS };

/** A provider that records what it was given and accepts every mail. */
function createProvider() {
  const calls: ProviderMessage[] = [];
  const provider: MailProvider = {
    name: "stub",
    send: (message) => {
      calls.push(message);
      return Promise.resolve({ status: "sent", id: "msg_1" });
    },
  };
  return { provider, calls };
}

describe("sendMail with a named sender", () => {
  let log: MockInstance<typeof console.error>;
  const logged = () => log.mock.calls.map((call) => call.join(" ")).join("\n");

  beforeEach(() => {
    log = vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => {
    log.mockRestore();
  });

  it("hands the provider the named sender's mailbox as from", async () => {
    const { provider, calls } = createProvider();
    const result = await sendMail({ config: createConfig(provider, { senders: SENDERS }) }, { ...MAIL, sender: "clientMail" });
    expect(result).toEqual({ ok: true, value: { id: "msg_1", provider: "stub" } });
    expect(calls).toEqual([{ ...MAIL, from: CLIENTS, replyTo: REPLY_TO, html: null, headers: {}, idempotencyKey: null }]);
  });

  it("sends from from when the mail names no sender", async () => {
    const { provider, calls } = createProvider();
    await sendMail({ config: createConfig(provider, { senders: SENDERS }) }, MAIL);
    expect(calls.map((call) => call.from)).toEqual([FROM]);
  });

  it.each<[string, unknown, Record<string, string> | undefined]>([
    ["a name the app did not configure", "billing", SENDERS],
    ["a name on a config without senders", "alerts", undefined],
    ["an address instead of a name", "eve@example.com", SENDERS],
    ["an empty name", "", SENDERS],
    ["a name that is not a string", 7, SENDERS],
    ["a name inherited from Object", "constructor", SENDERS],
  ])("refuses %s as invalid_input with fields=sender and sends nothing", async (_case, sender, senders) => {
    const { provider, calls } = createProvider();
    const config = createConfig(provider, senders === undefined ? {} : { senders });
    // @ts-expect-error: a JavaScript caller can pass any value as the sender.
    const mail: OutgoingMail = { ...MAIL, sender };
    expect(await sendMail({ config }, mail)).toEqual({ ok: false, error: "mailing.invalid_input" });
    expect(calls).toEqual([]);
    expect(logged()).toBe("mailing: send failed provider=stub reason=invalid_input status=none fields=sender");
  });

  it("checks the name's shape in validateMail and leaves the lookup to the config", () => {
    expect(validateMail({ ...MAIL, sender: "alerts" })).toMatchObject({ ok: true, value: { sender: "alerts" } });
    expect(validateMail(MAIL)).toMatchObject({ ok: true, value: { sender: null } });
    expect(validateMail({ ...MAIL, sender: "Alerts <alerts@example.com>" })).toEqual({ ok: false, fields: ["sender"] });
  });
});

describe("previewMail with a named sender", () => {
  it("shows the resolved From", () => {
    const config = createConfig(fakeMailProvider(), { senders: SENDERS });
    expect(previewMail(config, { ...MAIL, sender: "alerts" })).toMatchObject({ ok: true, value: { from: ALERTS } });
    expect(previewMail(config, MAIL)).toMatchObject({ ok: true, value: { from: FROM } });
  });

  it("reports an unknown name as the field sender", () => {
    const config = createConfig(fakeMailProvider(), { senders: SENDERS });
    expect(previewMail(config, { ...MAIL, sender: "billing" })).toEqual({ ok: false, error: "mailing.invalid_input", fields: ["sender"] });
  });
});

describe("deliveries with a named sender", () => {
  const SCOPE = "app.quote-confirmation:quote_7";
  let test: TestMailing;
  let log: MockInstance<typeof console.error>;
  const provider = fakeMailProvider();

  beforeEach(async () => {
    log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    provider.clear();
    test = await createTestMailing(createConfig(provider, { senders: SENDERS }));
  });
  afterEach(async () => {
    log.mockRestore();
    await test.database.close();
  });

  it("deliverOnce sends from the named sender", async () => {
    expect(await deliverOnce(test.ctx, { scope: SCOPE, mail: { ...MAIL, sender: "clientMail" } })).toMatchObject({ status: "sent" });
    expect(provider.sent.map((mail) => mail.from)).toEqual([CLIENTS]);
  });

  it("forecasts and closes a delivery with an unknown sender as invalid_input, sending nothing", async () => {
    const delivery = { scope: SCOPE, mail: { ...MAIL, sender: "billing" } };
    const forecast = await runDeliveries(test.ctx, { recipients: [delivery], build: (item) => item }, { dryRun: true });
    expect(forecast.rejected).toMatchObject({ "mailing.invalid_input": 1 });
    expect(await deliverOnce(test.ctx, delivery)).toEqual({ status: "rejected", reason: "mailing.invalid_input" });
    expect(provider.sent).toEqual([]);
  });
});

describe("mailing({ senders })", () => {
  it("keeps the senders it was given, trimmed", () => {
    const options = mailing({ from: FROM, senders: { alerts: `  ${ALERTS} ` }, provider: fakeMailProvider() }).options;
    expect(options.senders).toEqual({ alerts: ALERTS });
  });

  it("refuses a sender that is not a mailbox and a name that is not a sender name", () => {
    expect(() => mailing({ from: FROM, senders: { alerts: "alerts@example.com, eve@example.com" }, provider: fakeMailProvider() })).toThrow(
      "- options.senders.alerts: must be an address or Name <address>, e.g. Alerts <alerts@example.com>",
    );
    expect(() => mailing({ from: FROM, senders: { "client mail": CLIENTS }, provider: fakeMailProvider() })).toThrow(
      "- options.senders: every name must be a letter, then letters, digits, _ or -, at most 32 characters",
    );
  });
});
