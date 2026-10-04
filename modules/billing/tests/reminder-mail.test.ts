// Reminder mail through mailing on PGlite and the fake provider: one mail per account, kind and
// end, whatever runs repeat or overlap; the notice's copy with the last day and the payment link;
// a provider outage left for the next run; the pause between sends.
import { auth, AUTH_RATE_LIMIT_BUCKETS } from "@softure-ai/auth";
import { billing, billingMessages, BILLING_RATE_LIMIT_BUCKETS } from "@softure-ai/billing";
import { renderAccessReminderMail, sendAccessReminders } from "@softure-ai/billing/mailing";
import { changeEntitlement } from "@softure-ai/billing/server";
import { createTestClock, defineSoftureConfig, formatMessage, type Locale } from "@softure-ai/core";
import { createTestDatabase } from "@softure-ai/db/testing";
import { mailing } from "@softure-ai/mailing";
import { fakeMailProvider, type FakeMailProvider } from "@softure-ai/mailing/testing";
import { privacy, PRIVACY_RATE_LIMIT_BUCKETS } from "@softure-ai/privacy";
import { headerIp, security } from "@softure-ai/security";
import { afterEach, describe, expect, it } from "vitest";
import { createAccount, NOW, TIMEZONE, type TestBilling } from "./support.js";

/** 14 October, 10:00 in Warsaw: day 12 of 14, inside the 3-day trial reminder window. */
const IN_TRIAL_WINDOW = new Date("2026-10-14T08:00:00Z");
const PAYMENT_LINK = "https://app.example.com/payment";
const NO_PAUSE = { pauseMs: 0 };

interface MailTest extends TestBilling {
  readonly provider: FakeMailProvider;
}

let current: MailTest | undefined;

afterEach(async () => {
  await current?.database.close();
  current = undefined;
});

async function setUp(options: { locale?: Locale; provider?: FakeMailProvider } = {}): Promise<MailTest> {
  const provider = options.provider ?? fakeMailProvider();
  const config = defineSoftureConfig({
    database: { url: "pglite://" },
    locale: options.locale ?? "en",
    timezone: TIMEZONE,
    appOrigin: "https://app.example.com",
    modules: [
      security({ clientIp: headerIp("x-real-ip"), buckets: { ...AUTH_RATE_LIMIT_BUCKETS, ...PRIVACY_RATE_LIMIT_BUCKETS, ...BILLING_RATE_LIMIT_BUCKETS }, cleanupProbability: 0 }),
      auth({ password: { scrypt: { cost: 2 ** 10 } }, requireConsent: false }),
      privacy(),
      mailing({ from: "hello@example.com", provider }),
      billing({ trial: { days: 14, reminderDays: 3 }, paid: { reminderDays: 7 } }),
    ],
  });
  const database = await createTestDatabase(config.modules);
  const clock = createTestClock(NOW);
  current = { ctx: { db: database.db, clock, config }, clock, database, config, provider };
  return current;
}

describe("renderAccessReminderMail", () => {
  it("writes the notice's copy with the date, the link text and the bare link", () => {
    const mail = renderAccessReminderMail(billingMessages.en, { kind: "trial-ending", lastDay: "October 16, 2026", link: PAYMENT_LINK });
    expect(mail.subject).toBe("Your trial ends on October 16, 2026");
    expect(mail.text).toBe(
      "Your trial ends on October 16, 2026. Choose a plan to keep writing after that; your data stays safe either way.\n\nChoose a plan: https://app.example.com/payment",
    );
    expect(mail.html).toContain('<a href="https://app.example.com/payment">Choose a plan</a>');
  });

  it("asks a paid account to renew", () => {
    const mail = renderAccessReminderMail(billingMessages.en, { kind: "paid-ended", lastDay: "November 30, 2026", link: PAYMENT_LINK });
    expect(mail.subject).toBe("Your access has ended");
    expect(mail.text.endsWith("Renew access: https://app.example.com/payment")).toBe(true);
  });

  it("escapes the copy and the link in the HTML body", () => {
    const messages = { ...billingMessages.en, reminderMail: { ...billingMessages.en.reminderMail, trialEnded: { subject: "Ended", body: "<b>Tom & Jerry</b>" } } };
    const mail = renderAccessReminderMail(messages, { kind: "trial-ended", lastDay: "x", link: 'https://app.example.com/pay?a=1&b="2"' });
    expect(mail.html).toBe(
      '<p>&lt;b&gt;Tom &amp; Jerry&lt;/b&gt;</p>\n<p><a href="https://app.example.com/pay?a=1&amp;b=&quot;2&quot;">Choose a plan</a></p>',
    );
  });
});

describe("sendAccessReminders", () => {
  it("mails an account in its trial window once, with its last day and the payment link", async () => {
    const test = await setUp();
    await createAccount(test, "ada@example.com");
    test.clock.set(IN_TRIAL_WINDOW);

    expect(await sendAccessReminders(test.ctx, NO_PAUSE)).toEqual({ due: 1, sent: 1, skipped: 0, rejected: 0, retryLater: 0 });
    expect(test.provider.sent).toHaveLength(1);
    const [mail] = test.provider.sent;
    expect(mail?.to).toBe("ada@example.com");
    expect(mail?.subject).toBe("Your trial ends on October 16, 2026");
    expect(mail?.text).toContain(`Choose a plan: ${PAYMENT_LINK}`);
    expect(mail?.headers).not.toHaveProperty("List-Unsubscribe");

    test.clock.set(new Date("2026-10-15T08:00:00Z"));
    expect(await sendAccessReminders(test.ctx, NO_PAUSE)).toEqual({ due: 1, sent: 0, skipped: 1, rejected: 0, retryLater: 0 });
    expect(test.provider.sent).toHaveLength(1);
  });

  it("mails again for a new end: an extended trial is a new window", async () => {
    const test = await setUp();
    const userId = await createAccount(test, "ada@example.com");
    test.clock.set(IN_TRIAL_WINDOW);
    await sendAccessReminders(test.ctx, NO_PAUSE);

    expect((await changeEntitlement(test.ctx, userId, { type: "extend_trial", until: new Date("2026-10-17T22:00:00Z") })).ok).toBe(true);
    test.clock.set(new Date("2026-10-15T08:00:00Z"));
    expect(await sendAccessReminders(test.ctx, NO_PAUSE)).toMatchObject({ due: 1, sent: 1 });
    expect(test.provider.sent.map((mail) => mail.subject)).toEqual(["Your trial ends on October 16, 2026", "Your trial ends on October 17, 2026"]);
  });

  it("mails an ended trial within the catch-up days, and paid access ending and ended with the renew copy", async () => {
    const test = await setUp();
    await createAccount(test, "trial@example.com");
    const paid = await createAccount(test, "paid@example.com");
    expect((await changeEntitlement(test.ctx, paid, { type: "grant", until: new Date("2026-10-21T22:00:00Z") })).ok).toBe(true);

    test.clock.set(new Date("2026-10-18T08:00:00Z"));
    expect(await sendAccessReminders(test.ctx, NO_PAUSE)).toMatchObject({ due: 2, sent: 2 });
    test.clock.set(new Date("2026-10-23T08:00:00Z"));
    expect(await sendAccessReminders(test.ctx, NO_PAUSE)).toMatchObject({ due: 1, sent: 1 });

    expect(test.provider.sent.map((mail) => `${mail.to}: ${mail.subject}`)).toEqual([
      "trial@example.com: Your trial has ended",
      "paid@example.com: Your access ends on October 21, 2026",
      "paid@example.com: Your access has ended",
    ]);
    expect(test.provider.sent[1]?.text).toContain(`Renew access: ${PAYMENT_LINK}`);
  });

  it("mails nobody outside every window, nor an account with lifetime access", async () => {
    const test = await setUp();
    await createAccount(test, "new@example.com");
    const lifetime = await createAccount(test, "life@example.com");
    expect((await changeEntitlement(test.ctx, lifetime, { type: "grant_lifetime" })).ok).toBe(true);
    test.clock.set(new Date("2026-10-10T08:00:00Z"));

    expect(await sendAccessReminders(test.ctx, NO_PAUSE)).toEqual({ due: 0, sent: 0, skipped: 0, rejected: 0, retryLater: 0 });
    expect(test.provider.sent).toEqual([]);
  });

  it("leaves a mail the provider could not take for the next run", async () => {
    let isDown = true;
    const provider = fakeMailProvider({ respond: () => (isDown ? { status: "unavailable" } : undefined) });
    const test = await setUp({ provider });
    await createAccount(test, "ada@example.com");
    test.clock.set(IN_TRIAL_WINDOW);

    expect(await sendAccessReminders(test.ctx, NO_PAUSE)).toEqual({ due: 1, sent: 0, skipped: 0, rejected: 0, retryLater: 1 });
    isDown = false;
    expect(await sendAccessReminders(test.ctx, NO_PAUSE)).toEqual({ due: 1, sent: 1, skipped: 0, rejected: 0, retryLater: 0 });
    expect(provider.sent).toHaveLength(1);
  });

  it("sends one mail when two runs overlap", async () => {
    const test = await setUp();
    await createAccount(test, "ada@example.com");
    test.clock.set(IN_TRIAL_WINDOW);

    const summaries = await Promise.all([sendAccessReminders(test.ctx, NO_PAUSE), sendAccessReminders(test.ctx, NO_PAUSE)]);
    expect(test.provider.sent).toHaveLength(1);
    expect(summaries.map((summary) => summary.sent).toSorted()).toEqual([0, 1]);
    for (const summary of summaries) expect(summary.sent + summary.skipped).toBe(summary.due);
  });

  it("pauses after each mail the provider was called for, never after a skipped one", async () => {
    const test = await setUp();
    await createAccount(test, "ada@example.com");
    await createAccount(test, "bob@example.com");
    test.clock.set(IN_TRIAL_WINDOW);
    const pauses: number[] = [];
    const sleep = (ms: number) => {
      pauses.push(ms);
      return Promise.resolve();
    };

    await sendAccessReminders(test.ctx, { pauseMs: 250, sleep });
    expect(pauses).toEqual([250, 250]);
    await sendAccessReminders(test.ctx, { pauseMs: 250, sleep });
    expect(pauses).toEqual([250, 250]);
  });

  it("writes the mail in the app's locale", async () => {
    const test = await setUp({ locale: "pl" });
    await createAccount(test, "ada@example.com");
    test.clock.set(IN_TRIAL_WINDOW);

    await sendAccessReminders(test.ctx, NO_PAUSE);
    const copy = billingMessages.pl;
    const lastDay = new Intl.DateTimeFormat("pl", { dateStyle: "long", timeZone: TIMEZONE }).format(new Date("2026-10-16T12:00:00Z"));
    expect(test.provider.sent[0]?.subject).toBe(formatMessage(copy.reminderMail.trialEnding.subject, { date: lastDay }));
    expect(test.provider.sent[0]?.text).toContain(`${copy.notice.choosePlan}: ${PAYMENT_LINK}`);
  });
});
