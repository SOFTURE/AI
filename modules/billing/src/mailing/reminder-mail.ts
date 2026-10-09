// The reminder mail: the in-app notice's four states as a mail, sent once per account, kind and
// end through `@softure-ai/mailing`'s delivery ledger. A transactional mail (an account notice): no
// unsubscribe link, never suppressed. The copy comes from billing's dictionary in the app's locale;
// the link to the payment page is placed by the code, so a copy override cannot drop it.
import { formatMessage, type ModuleContext } from "@softure-ai/core";
import type { Queryable } from "@softure-ai/db";
import type { OutgoingMail } from "@softure-ai/mailing";
import { deliverOnce } from "@softure-ai/mailing/server";
import type { BillingMessages } from "../messages/index.js";
import { getAccessReminderScope, type AccessReminderKind } from "../reminder.js";
import { getBillingMessages, getBillingRoutes } from "../server/options.js";
import { findAccessReminders, type AccessReminderDue, type FindAccessRemindersOptions } from "../server/reminders.js";
import { formatLastDay } from "../ui/format.js";

/** Pause between two mails a provider was called for: Resend allows two requests per second. */
export const DEFAULT_REMINDER_PAUSE_MS = 500;

export interface AccessReminderMailInput {
  readonly kind: AccessReminderKind;
  /** The last day with access, as the app's locale writes it (`formatLastDay`). */
  readonly lastDay: string;
  /** The payment page's absolute URL. */
  readonly link: string;
}

/** The subject and bodies of a reminder mail, without the recipient. */
export type AccessReminderMail = Pick<OutgoingMail, "subject" | "text"> & { readonly html: string };

/** What the app's template gets for one due account. */
export interface AccessReminderMailContext {
  /** The due account (id, email), the kind of reminder and the first instant without access. */
  readonly reminder: AccessReminderDue;
  /** The last day with access, as the app's locale writes it (`formatLastDay`). */
  readonly lastDay: string;
  /** The payment page's absolute URL. */
  readonly link: string;
  /** The package's own mail for this reminder, to send as is or to change. */
  readonly mail: AccessReminderMail;
}

export interface SendAccessRemindersOptions extends FindAccessRemindersOptions {
  /**
   * The app's template: the mail to send this account, or null to send it nothing this run (counted in `skipped`;
   * a later run asks again). The package's own mail by default. A throw propagates; the next run resumes.
   */
  readonly buildMail?: (context: AccessReminderMailContext) => AccessReminderMail | null | Promise<AccessReminderMail | null>;
  /**
   * The delivery scope in `mailing.deliveries` (`getAccessReminderScope` by default). An app moving from its own
   * job passes the scope that job used, so accounts it already mailed are not mailed twice. It must be unique per
   * account, kind and end: two reminders under one scope get one mail.
   */
  readonly getScope?: (reminder: AccessReminderDue) => string;
  /** Milliseconds to wait after each mail a provider was called for. Default 500; 0 never waits. */
  readonly pauseMs?: number;
  /** How to wait; tests pass their own. */
  readonly sleep?: (ms: number) => Promise<void>;
}

export interface AccessReminderSummary {
  /** Accounts due a reminder this run. */
  readonly due: number;
  /** Mails sent now. */
  readonly sent: number;
  /**
   * Mails an earlier run sent (or refused), another run is sending right now, whose send was interrupted
   * so long ago that it may have gone out (mailing's `uncertain`), or the app's template returned null for.
   */
  readonly skipped: number;
  /** Mails refused for good (an invalid address, the provider rejected it). */
  readonly rejected: number;
  /**
   * Mails the provider could not take now; the next run sends them. A refused account or a spent quota stops the
   * run there: the mails after it are not counted and go out on the next run.
   */
  readonly retryLater: number;
}

const COPY_KEYS = {
  "trial-ending": "trialEnding",
  "paid-ending": "paidEnding",
  "trial-ended": "trialEnded",
  "paid-ended": "paidEnded",
} as const satisfies Record<AccessReminderKind, keyof BillingMessages["reminderMail"]>;

const HTML_ESCAPES: Readonly<Record<string, string>> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => HTML_ESCAPES[character] ?? character);
}

/**
 * Renders a reminder from `messages` (one locale's dictionary, overrides applied): a plain-text body
 * with the notice's link text and the bare link, and an HTML body with the link as an anchor.
 */
export function renderAccessReminderMail(messages: BillingMessages, input: AccessReminderMailInput): AccessReminderMail {
  const copy = messages.reminderMail[COPY_KEYS[input.kind]];
  const action = input.kind.startsWith("trial-") ? messages.notice.choosePlan : messages.notice.renew;
  const values = { date: input.lastDay };
  const subject = formatMessage(copy.subject, values);
  const body = formatMessage(copy.body, values);
  const text = [body, `${action}: ${input.link}`].join("\n\n");
  const html = [`<p>${escapeHtml(body)}</p>`, `<p><a href="${escapeHtml(input.link)}">${escapeHtml(action)}</a></p>`].join("\n");
  return { subject, text, html };
}

function getDefaultScope(reminder: AccessReminderDue): string {
  return getAccessReminderScope(reminder.kind, reminder.userId, reminder.endsAt);
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Mails every account due a reminder (`findAccessReminders`) through mailing's delivery ledger, so
 * each account gets one mail per kind and end however often the run repeats or overlaps. Call it
 * on a schedule (a daily cron job running a script). Needs `mailing({ ... })` in the config; a
 * database failure propagates (the next run resumes, and the ledger keeps it from mailing twice).
 */
export async function sendAccessReminders(ctx: ModuleContext<Queryable>, options: SendAccessRemindersOptions = {}): Promise<AccessReminderSummary> {
  const { pauseMs = DEFAULT_REMINDER_PAUSE_MS, sleep = wait, buildMail, getScope = getDefaultScope, ...findOptions } = options;
  const due = await findAccessReminders(ctx, findOptions);
  const messages = getBillingMessages(ctx.config);
  const link = new URL(getBillingRoutes(ctx.config).payment, ctx.config.appOrigin).href;
  const counts = { sent: 0, skipped: 0, rejected: 0, retryLater: 0 };

  for (const reminder of due) {
    const lastDay = formatLastDay(reminder.endsAt, ctx.config.locale, ctx.config.timezone);
    const defaultMail = renderAccessReminderMail(messages, { kind: reminder.kind, lastDay, link });
    const mail = buildMail === undefined ? defaultMail : await buildMail({ reminder, lastDay, link, mail: defaultMail });
    if (mail === null) {
      counts.skipped += 1;
      continue;
    }
    const outcome = await deliverOnce(ctx, { scope: getScope(reminder), mail: { to: reminder.email, ...mail } });
    if (outcome.status === "done" || outcome.status === "in-flight" || outcome.status === "uncertain") {
      counts.skipped += 1;
      continue;
    }
    if (outcome.status === "halted") {
      // The account cannot send (refused key, spent quota): every other mail would fail the same way.
      counts.retryLater += 1;
      break;
    }
    if (outcome.status === "sent") counts.sent += 1;
    else if (outcome.status === "rejected") counts.rejected += 1;
    else counts.retryLater += 1;
    if (pauseMs > 0) await sleep(pauseMs);
  }
  return { due: due.length, ...counts };
}
