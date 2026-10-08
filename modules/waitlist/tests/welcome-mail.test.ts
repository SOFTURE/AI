// The welcome mail: list mail through mailing's delivery ledger, at most once per sign-up, in the
// sign-up's language, never to an address that unsubscribed, and not at all when turned off.
import { getRecipientKey, suppressRecipient } from "@softure-ai/mailing/server";
import { deliverWelcomeMail, getWelcomeMailScope, joinWaitlist } from "@softure-ai/waitlist/server";
import { waitlistMessages, type WaitlistMailTemplateInput, type WaitlistSignup } from "@softure-ai/waitlist";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CLIENT, createTestWaitlist, OPTIONS, type ConfigOptions, type TestWaitlist } from "./support.js";

const ADA = "ada@example.com";
const UNSUBSCRIBE_ANCHOR = /<p>[^<]+ <a href="https:\/\/app\.example\.com\/unsubscribe\?r=[^"]+">[^<]+<\/a><\/p>$/;

async function signUp(test: TestWaitlist): Promise<WaitlistSignup> {
  const result = await joinWaitlist(test.ctx, { email: ADA, scopes: ["launch"], placement: "hero", clientKey: CLIENT });
  if (!result.ok) throw new Error(`signUp failed with ${result.error}`);
  if (result.value.status === "suppressed") throw new Error("signUp found the address suppressed");
  return result.value.signup;
}

describe("deliverWelcomeMail", () => {
  let test: TestWaitlist;

  async function setUp(options: ConfigOptions = {}): Promise<void> {
    test = await createTestWaitlist(options);
  }

  beforeEach(() => {
    vi.stubEnv("MAILING_UNSUBSCRIBE_SECRET", "test-unsubscribe-secret-32-chars");
  });
  afterEach(async () => {
    vi.unstubAllEnvs();
    await test.database.close();
  });

  it("sends the welcome mail once, as list mail with mailing's unsubscribe link", async () => {
    await setUp();
    const signup = await signUp(test);
    const outcome = await deliverWelcomeMail(test.ctx, signup);
    expect(outcome).toEqual({ status: "sent", id: expect.stringMatching(/^fake-/) as unknown });
    expect(await deliverWelcomeMail(test.ctx, signup)).toEqual({ status: "done", outcome: "sent" });

    const [mail, ...rest] = test.provider.sent;
    expect(rest).toEqual([]);
    expect(mail?.to).toBe(ADA);
    expect(mail?.subject).toBe(waitlistMessages.en.welcomeMail.subject);
    expect(mail?.text.startsWith(waitlistMessages.en.welcomeMail.text)).toBe(true);
    expect(mail?.headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
    expect(mail?.idempotencyKey).toBe(`${getWelcomeMailScope(signup.id)}:${getRecipientKey(ADA)}`);
    const ledger = await test.database.client.query<{ scope: string; kind: string; status: string }>("SELECT scope, kind, status FROM mailing.deliveries");
    expect(ledger.rows).toEqual([{ scope: getWelcomeMailScope(signup.id), kind: "waitlist", status: "sent" }]);
  });

  it("writes in the sign-up's locale, with the app's overrides", async () => {
    await setUp({ locale: "pl", waitlist: { ...OPTIONS, messages: { pl: { welcomeMail: { subject: "Witaj na liscie Acme" } } } } });
    const signup = await signUp(test);
    expect(signup.locale).toBe("pl");
    await deliverWelcomeMail(test.ctx, signup);
    expect(test.provider.sent[0]?.subject).toBe("Witaj na liscie Acme");
    expect(test.provider.sent[0]?.text.startsWith(waitlistMessages.pl.welcomeMail.text)).toBe(true);
  });

  it("is refused for an address that unsubscribed from list mail", async () => {
    await setUp();
    const signup = await signUp(test);
    await suppressRecipient(test.ctx, ADA);
    expect(await deliverWelcomeMail(test.ctx, signup)).toEqual({ status: "rejected", reason: "mailing.suppressed" });
    expect(test.provider.sent).toEqual([]);
  });

  it("sends an HTML body built from the same copy, with mailing's unsubscribe link", async () => {
    await setUp();
    await deliverWelcomeMail(test.ctx, await signUp(test));
    const html = test.provider.sent[0]?.html ?? "";
    expect(html.startsWith("<p>Hello,</p>\n<p>thank you for joining the waitlist. We will write to you as soon as we open.</p>\n<p>")).toBe(true);
    expect(html).toMatch(UNSUBSCRIBE_ANCHOR);
  });

  it("escapes the app's copy in the HTML body and keeps its line breaks", async () => {
    await setUp({ waitlist: { ...OPTIONS, messages: { en: { welcomeMail: { text: "Hi <b>Ada</b> & co,\nline two\n\n\n  last  " } } } } });
    await deliverWelcomeMail(test.ctx, await signUp(test));
    expect(test.provider.sent[0]?.html?.startsWith("<p>Hi &lt;b&gt;Ada&lt;/b&gt; &amp; co,<br>line two</p>\n<p>last</p>\n<p>")).toBe(true);
  });

  it("renders the HTML body with the app's mailTemplate, and mailing adds its footer inside the body", async () => {
    const inputs: WaitlistMailTemplateInput[] = [];
    const mailTemplate = (mail: WaitlistMailTemplateInput): string => {
      inputs.push(mail);
      return `<html><body><h1>Acme</h1>${mail.body}</body></html>`;
    };
    await setUp({ locale: "pl", waitlist: { ...OPTIONS, mailTemplate } });
    await deliverWelcomeMail(test.ctx, await signUp(test));

    const copy = waitlistMessages.pl.welcomeMail;
    // The Polish copy has no character HTML escapes, so its paragraphs appear as they are.
    const body = copy.text
      .split("\n\n")
      .map((paragraph) => `<p>${paragraph}</p>`)
      .join("\n");
    expect(inputs).toEqual([{ kind: "welcome", locale: "pl", subject: copy.subject, paragraphs: copy.text.split("\n\n"), body }]);
    const html = test.provider.sent[0]?.html ?? "";
    expect(html.startsWith(`<html><body><h1>Acme</h1>${body}<p>`)).toBe(true);
    expect(html.endsWith("</a></p>\n</body></html>")).toBe(true);
    expect(test.provider.sent[0]?.text.startsWith(copy.text)).toBe(true);
  });

  it("throws, sending nothing, when the app's mailTemplate returns blank HTML", async () => {
    await setUp({ waitlist: { ...OPTIONS, mailTemplate: () => "  " } });
    await expect(deliverWelcomeMail(test.ctx, await signUp(test))).rejects.toThrow("mailTemplate returned no HTML for the welcome mail");
    expect(test.provider.sent).toEqual([]);
  });

  it("sends nothing with welcomeMail: false", async () => {
    await setUp({ waitlist: { ...OPTIONS, welcomeMail: false } });
    expect(await deliverWelcomeMail(test.ctx, await signUp(test))).toEqual({ status: "skipped" });
    expect(test.provider.sent).toEqual([]);
  });
});
