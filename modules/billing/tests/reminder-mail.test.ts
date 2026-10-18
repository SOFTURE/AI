// Reminder mail through mailing on PGlite and the fake provider: one mail per account, kind and
// end, whatever runs repeat or overlap; the notice's copy with the last day and the payment link;
// a provider outage left for the next run; the pause between sends.
import { auth, AUTH_RATE_LIMIT_BUCKETS } from "@softure-ai/auth";
import { billing, billingMessages, BILLING_RATE_LIMIT_BUCKETS } from "@softure-ai/billing";
import { renderAccessReminderMail, sendAccessReminders, type AccessReminderSummary } from "@softure-ai/billing/mailing";
import { changeEntitlement } from "@softure-ai/billing/server";
import { createTestClock, defineSoftureConfig, formatMessage, type Locale } from "@softure-ai/core";
import { createTestDatabase } from "@softure-ai/db/testing";
import { mailing } from "@softure-ai/mailing";
import { deliverOnce } from "@softure-ai/mailing/server";
import { fakeMailProvider, type FakeMailProvider } from "@softure-ai/mailing/testing";
import { privacy, PRIVACY_RATE_LIMIT_BUCKETS } from "@softure-ai/privacy";
import { headerIp, security } from "@softure-ai/security";
import { afterEach, describe, expect, it } from "vitest";
import { createAccount, NOW, TIMEZONE, type TestBilling } from "./support.js";

/** 14 October, 10:00 in Warsaw: day 12 of 14, inside the 3-day trial reminder window. */
const IN_TRIAL_WINDOW = new Date("2026-10-14T08:00:00Z");
const PAYMENT_LINK = "https://app.example.com/payment";
const NO_PAUSE = { pauseMs: 0 };
const NO_REJECTIONS = { "mailing.invalid_input": 0, "mailing.rejected": 0, "mailing.unavailable": 0, "mailing.suppressed": 0, "mailing.provider_refused": 0, "mailing.quota_exceeded": 0 };

/** A run summary: nothing counted but `counts`, every due account read, no halt, nothing left past a limit. */
function summary(counts: Partial<AccessReminderSummary> & { readonly due: number }): AccessReminderSummary {
  return { dryRun: false, recipients: counts.due, skipped: 0, sent: 0, rejected: NO_REJECTIONS, done: 0, inFlight: 0, retryLater: 0, uncertain: 0, halted: null, remaining: 0, ...counts };
}

interface MailTest extends TestBilling {
  readonly provider: FakeMailProvider;
}

let current: MailTest | undefined;

afterEach(async () => {
  await current?.database.close();
  current = undefined;
});

async function setUp(options: { locale?: Locale; provider?: FakeMailProvider; messages?: NonNullable<Parameters<typeof billing>[0]>["messages"] } = {}): Promise<MailTest> {
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
      billing({ trial: { days: 14, reminderDays: 3 }, paid: { reminderDays: 7 }, ...(options.messages === undefined ? {} : { messages: options.messages }) }),
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

    expect(await sendAccessReminders(test.ctx, NO_PAUSE)).toEqual(summary({ due: 1, sent: 1 }));
    expect(test.provider.sent).toHaveLength(1);
    const [mail] = test.provider.sent;
    expect(mail?.to).toBe("ada@example.com");
    expect(mail?.subject).toBe("Your trial ends on October 16, 2026");
    expect(mail?.text).toContain(`Choose a plan: ${PAYMENT_LINK}`);
    expect(mail?.headers).not.toHaveProperty("List-Unsubscribe");

    test.clock.set(new Date("2026-10-15T08:00:00Z"));
    expect(await sendAccessReminders(test.ctx, NO_PAUSE)).toEqual(summary({ due: 1, done: 1 }));
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

    expect(await sendAccessReminders(test.ctx, NO_PAUSE)).toEqual(summary({ due: 0 }));
    expect(test.provider.sent).toEqual([]);
  });

  it("stops at a mail the provider could not take, leaving it and the rest for the next run", async () => {
    let isDown = true;
    const provider = fakeMailProvider({ respond: () => (isDown ? { status: "unavailable" } : undefined) });
    const test = await setUp({ provider });
    await createAccount(test, "ada@example.com");
    await createAccount(test, "bob@example.com");
    test.clock.set(IN_TRIAL_WINDOW);

    expect(await sendAccessReminders(test.ctx, NO_PAUSE)).toEqual(
      summary({ due: 2, recipients: 1, retryLater: 1, halted: { reason: "mailing.unavailable" }, remaining: null }),
    );
    isDown = false;
    expect(await sendAccessReminders(test.ctx, NO_PAUSE)).toEqual(summary({ due: 2, sent: 2 }));
    expect(provider.sent).toHaveLength(2);
  });

  it("stops the run at a refused account, leaving that mail and the rest for the next run", async () => {
    let isRefused = true;
    const provider = fakeMailProvider({ respond: () => (isRefused ? { status: "refused", httpStatus: 401 } : undefined) });
    const test = await setUp({ provider });
    await createAccount(test, "ada@example.com");
    await createAccount(test, "bob@example.com");
    test.clock.set(IN_TRIAL_WINDOW);

    expect(await sendAccessReminders(test.ctx, NO_PAUSE)).toEqual(
      summary({ due: 2, recipients: 1, retryLater: 1, halted: { reason: "mailing.provider_refused", httpStatus: 401 }, remaining: null }),
    );
    isRefused = false;
    expect(await sendAccessReminders(test.ctx, NO_PAUSE)).toEqual(summary({ due: 2, sent: 2 }));
  });

  it("skips a mail whose send was interrupted long ago, which may have gone out", async () => {
    const provider = fakeMailProvider();
    const test = await setUp({ provider });
    await createAccount(test, "ada@example.com");
    test.clock.set(IN_TRIAL_WINDOW);
    await sendAccessReminders(test.ctx, NO_PAUSE);
    await test.database.client.query("UPDATE mailing.deliveries SET status = 'claimed', provider_message_id = NULL, finished_at = NULL, claimed_at = $1", [
      new Date(IN_TRIAL_WINDOW.getTime() - 48 * 3_600_000),
    ]);

    expect(await sendAccessReminders(test.ctx, NO_PAUSE)).toEqual(summary({ due: 1, uncertain: 1 }));
    expect(provider.sent).toHaveLength(1);
  });

  it("sends one mail when two runs overlap", async () => {
    const test = await setUp();
    await createAccount(test, "ada@example.com");
    test.clock.set(IN_TRIAL_WINDOW);

    const summaries = await Promise.all([sendAccessReminders(test.ctx, NO_PAUSE), sendAccessReminders(test.ctx, NO_PAUSE)]);
    expect(test.provider.sent).toHaveLength(1);
    expect(summaries.map((summary) => summary.sent).toSorted()).toEqual([0, 1]);
    for (const run of summaries) expect(run.sent + run.done + run.inFlight).toBe(run.due);
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

  it("writes the mail in the app's locale with the app's translation, English where it has none", async () => {
    const subject = "Deine Testphase endet am {date}";
    const test = await setUp({ locale: "de", messages: { de: { reminderMail: { trialEnding: { subject } } } } });
    await createAccount(test, "ada@example.com");
    test.clock.set(IN_TRIAL_WINDOW);

    await sendAccessReminders(test.ctx, NO_PAUSE);
    const lastDay = new Intl.DateTimeFormat("de", { dateStyle: "long", timeZone: TIMEZONE }).format(new Date("2026-10-16T12:00:00Z"));
    expect(test.provider.sent[0]?.subject).toBe(formatMessage(subject, { date: lastDay }));
    expect(test.provider.sent[0]?.text).toContain(`${billingMessages.en.notice.choosePlan}: ${PAYMENT_LINK}`);
  });
});

describe("sendAccessReminders with the app's template and scopes", () => {
  it("sends the app's mail, built from the due account, its last day, the link and the package's own mail", async () => {
    const test = await setUp();
    const userId = await createAccount(test, "ada@example.com");
    test.clock.set(IN_TRIAL_WINDOW);
    const contexts: unknown[] = [];

    const run = await sendAccessReminders(test.ctx, {
      ...NO_PAUSE,
      buildMail: (context) => {
        contexts.push(context);
        return { subject: `Ending ${context.lastDay}`, text: `Plans: ${context.link}`, html: `<p>${context.reminder.kind}</p>` };
      },
    });

    expect(run).toEqual(summary({ due: 1, sent: 1 }));
    expect(contexts).toEqual([
      {
        reminder: { userId, email: "ada@example.com", kind: "trial-ending", endsAt: new Date("2026-10-16T22:00:00Z"), endsAtMicros: "1792188000000000" },
        lastDay: "October 16, 2026",
        link: PAYMENT_LINK,
        mail: renderAccessReminderMail(billingMessages.en, { kind: "trial-ending", lastDay: "October 16, 2026", link: PAYMENT_LINK }),
        ctx: test.ctx,
      },
    ]);
    expect(test.provider.sent.map((mail) => [mail.to, mail.subject, mail.text, mail.html])).toEqual([
      ["ada@example.com", "Ending October 16, 2026", `Plans: ${PAYMENT_LINK}`, "<p>trial-ending</p>"],
    ]);
  });

  it("sends a plain-text mail from a template that returns no HTML body", async () => {
    const test = await setUp();
    await createAccount(test, "ada@example.com");
    test.clock.set(IN_TRIAL_WINDOW);

    const run = await sendAccessReminders(test.ctx, { ...NO_PAUSE, buildMail: (context) => ({ subject: `Ending ${context.lastDay}`, text: `Plans: ${context.link}` }) });

    expect(run).toEqual(summary({ due: 1, sent: 1 }));
    expect(test.provider.sent.map((mail) => [mail.to, mail.subject, mail.text, mail.html])).toEqual([["ada@example.com", "Ending October 16, 2026", `Plans: ${PAYMENT_LINK}`, null]]);
  });

  it("sends nothing to an account the template returns null for, and counts it as skipped", async () => {
    const test = await setUp();
    await createAccount(test, "ada@example.com");
    await createAccount(test, "invitee@example.com");
    test.clock.set(IN_TRIAL_WINDOW);

    const run = await sendAccessReminders(test.ctx, {
      ...NO_PAUSE,
      buildMail: async (context) => Promise.resolve(context.reminder.email.startsWith("invitee") ? null : context.mail),
    });

    expect(run).toEqual(summary({ due: 2, sent: 1, skipped: 1 }));
    expect(test.provider.sent.map((mail) => mail.to)).toEqual(["ada@example.com"]);
  });

  it("delivers under the app's scope, so an account its own job already mailed is not mailed twice", async () => {
    const test = await setUp();
    const mailed = await createAccount(test, "mailed@example.com");
    await createAccount(test, "new@example.com");
    test.clock.set(IN_TRIAL_WINDOW);
    const getScope = (reminder: { readonly userId: string; readonly endsAt: Date }) => `app.trial-ending:${reminder.userId}:${String(reminder.endsAt.getTime())}`;
    const earlier = await deliverOnce(test.ctx, {
      scope: getScope({ userId: mailed, endsAt: new Date("2026-10-16T22:00:00Z") }),
      mail: { to: "mailed@example.com", subject: "From the app's own job", text: "Earlier" },
    });
    expect(earlier.status).toBe("sent");

    expect(await sendAccessReminders(test.ctx, { ...NO_PAUSE, getScope })).toEqual(summary({ due: 2, sent: 1, done: 1 }));
    expect(test.provider.sent.map((mail) => `${mail.to}: ${mail.subject}`)).toEqual([
      "mailed@example.com: From the app's own job",
      "new@example.com: Your trial ends on October 16, 2026",
    ]);
  });
});

describe("sendAccessReminders as a delivery run", () => {
  it("counts in a dry run what a real run would send, and sends and writes nothing", async () => {
    const test = await setUp();
    await createAccount(test, "ada@example.com");
    await createAccount(test, "bob@example.com");
    test.clock.set(IN_TRIAL_WINDOW);

    expect(await sendAccessReminders(test.ctx, { ...NO_PAUSE, dryRun: true })).toEqual(summary({ due: 2, sent: 2, dryRun: true }));
    expect(test.provider.sent).toEqual([]);
    const ledger = await test.database.client.query<{ count: number }>("SELECT count(*)::int AS count FROM mailing.deliveries");
    expect(ledger.rows[0]?.count).toBe(0);
  });

  it("sends at most `limit` mails and counts the rest for the next run", async () => {
    const test = await setUp();
    await createAccount(test, "ada@example.com");
    await createAccount(test, "bob@example.com");
    await createAccount(test, "cy@example.com");
    test.clock.set(IN_TRIAL_WINDOW);

    expect(await sendAccessReminders(test.ctx, { ...NO_PAUSE, limit: 2 })).toEqual(summary({ due: 3, sent: 2, remaining: 1 }));
    expect(test.provider.sent).toHaveLength(2);
    expect(await sendAccessReminders(test.ctx, { ...NO_PAUSE, limit: 2 })).toEqual(summary({ due: 3, sent: 1, done: 2 }));
    expect(test.provider.sent).toHaveLength(3);
  });

  it("refuses a limit that is not a whole number of at least 1", async () => {
    const test = await setUp();
    await expect(sendAccessReminders(test.ctx, { ...NO_PAUSE, limit: 0 })).rejects.toThrow(RangeError);
  });

  it("resends a mail whose send was interrupted long ago only with retakeUncertain", async () => {
    const test = await setUp();
    await createAccount(test, "ada@example.com");
    test.clock.set(IN_TRIAL_WINDOW);
    await sendAccessReminders(test.ctx, NO_PAUSE);
    await test.database.client.query("UPDATE mailing.deliveries SET status = 'claimed', provider_message_id = NULL, finished_at = NULL, claimed_at = $1", [
      new Date(IN_TRIAL_WINDOW.getTime() - 48 * 3_600_000),
    ]);

    expect(await sendAccessReminders(test.ctx, NO_PAUSE)).toEqual(summary({ due: 1, uncertain: 1 }));
    expect(await sendAccessReminders(test.ctx, { ...NO_PAUSE, retakeUncertain: true })).toEqual(summary({ due: 1, sent: 1 }));
    // The provider answers the retake's idempotency key with the first mail, as a real one does.
    expect(test.provider.sent).toHaveLength(1);
  });

  it("reports every delivery's outcome to onDelivery", async () => {
    const test = await setUp();
    await createAccount(test, "ada@example.com");
    await createAccount(test, "bob@example.com");
    test.clock.set(IN_TRIAL_WINDOW);
    await sendAccessReminders(test.ctx, { ...NO_PAUSE, limit: 1 });
    const statuses: string[] = [];

    await sendAccessReminders(test.ctx, { ...NO_PAUSE, onDelivery: (outcome) => statuses.push(outcome.status) });
    expect(statuses.toSorted()).toEqual(["done", "sent"]);
  });

  it("finds the app's own ledger entry under a scope it built in SQL from the stored end, microseconds included", async () => {
    const test = await setUp();
    const userId = await createAccount(test, "ada@example.com");
    expect((await changeEntitlement(test.ctx, userId, { type: "extend_trial", until: new Date("2026-10-16T22:00:00Z") })).ok).toBe(true);
    await test.database.client.query("UPDATE billing.entitlements SET trial_ends_at = '2026-10-16 22:00:00.654321+00' WHERE user_id = $1", [userId]);
    const written = await test.database.client.query<{ scope: string }>(
      "SELECT 'app.trial-ending:' || user_id || ':' || (extract(epoch from trial_ends_at) * 1000000)::bigint::text AS scope FROM billing.entitlements WHERE user_id = $1",
      [userId],
    );
    const scope = written.rows[0]?.scope;
    if (scope === undefined) throw new Error("no entitlement row");
    expect((await deliverOnce(test.ctx, { scope, mail: { to: "ada@example.com", subject: "From the app's own job", text: "Earlier" } })).status).toBe("sent");
    // The stored end lies just past midnight, so its last day is 17 October: the 15th is inside the window.
    test.clock.set(new Date("2026-10-15T08:00:00Z"));

    const run = await sendAccessReminders(test.ctx, { ...NO_PAUSE, getScope: (reminder) => `app.${reminder.kind}:${reminder.userId}:${reminder.endsAtMicros}` });
    expect(run).toEqual(summary({ due: 1, done: 1 }));
    expect(test.provider.sent).toHaveLength(1);
  });
});
