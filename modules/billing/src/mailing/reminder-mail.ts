// The reminder mail: the in-app notice's four states as a mail, sent once per account, kind and
// end through `@softure-ai/mailing`'s delivery ledger, as one `runDeliveries` run (dry run, limit and
// resume included). A transactional mail (an account notice): no
// unsubscribe link, never suppressed. The copy comes from billing's dictionary in the app's locale;
// the link to the payment page is placed by the code, so a copy override cannot drop it.
import { formatMessage, type ModuleContext } from "@softure-ai/core";
import type { Queryable } from "@softure-ai/db";
import type { OutgoingMail } from "@softure-ai/mailing";
import { runDeliveries, type Delivery, type DeliveryOutcome, type DeliveryRunSummary, type RunDeliveriesOptions } from "@softure-ai/mailing/server";
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

/** What the app's template returns: a subject, a plain-text body and, optionally, an HTML body. */
export type AccessReminderTemplateMail = Pick<OutgoingMail, "subject" | "text" | "html">;

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
  /**
   * The module context the run was given (`sendAccessReminders(ctx, ...)`; the job's own under
   * `createBillingJobHandlers`): its `db` and `clock` let the template read the account at send time.
   */
  readonly ctx: ModuleContext<Queryable>;
}

/** Which reminder a delivery outcome is for (`sendAccessReminders`' `onDelivery`). */
export interface AccessReminderDelivery {
  readonly accountId: string;
  readonly kind: AccessReminderKind;
  /** The delivery scope in `mailing.deliveries` (the app's own when it passes `getScope`). */
  readonly scope: string;
}

export interface SendAccessRemindersOptions extends FindAccessRemindersOptions, Omit<RunDeliveriesOptions, "onDelivery"> {
  /**
   * The app's template: the mail to send this account, or null to send it nothing this run (counted in `skipped`;
   * a later run asks again). Without `html` the mail goes out as plain text. The package's own mail by default.
   * It runs in a dry run too, so it must not write. A throw propagates; the next run resumes.
   */
  readonly buildMail?: (context: AccessReminderMailContext) => AccessReminderTemplateMail | null | Promise<AccessReminderTemplateMail | null>;
  /**
   * The delivery scope in `mailing.deliveries` (`getAccessReminderScope` by default). An app moving from its own
   * job passes the scope that job used, so accounts it already mailed are not mailed twice; `endsAtMicros` is the
   * end exactly as stored, for a scope that job built in SQL. It must be unique per account, kind and end: two
   * reminders under one scope get one mail.
   */
  readonly getScope?: (reminder: AccessReminderDue) => string;
  /** Milliseconds to wait after each mail a provider was called for. Default 500; 0 never waits. */
  readonly pauseMs?: number;
  /**
   * Called after every delivery of a real run with its outcome and the reminder it was for (the account, the kind,
   * the scope), e.g. to record an analytics event per account. Never receives the address; an account the template
   * skipped gets no call.
   */
  readonly onDelivery?: (outcome: DeliveryOutcome, reminder: AccessReminderDelivery) => void;
}

/**
 * The run's counts (mailing's `DeliveryRunSummary`: `sent`, `skipped` for a null template, `done`, `inFlight`,
 * `uncertain`, `rejected` by reason, `retryLater`, `halted`, `remaining`) and the accounts due a reminder.
 */
export interface AccessReminderSummary extends DeliveryRunSummary {
  /** Accounts due a reminder this run. */
  readonly due: number;
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

/**
 * Mails every account due a reminder (`findAccessReminders`) through mailing's delivery ledger
 * (`runDeliveries`), so each account gets one mail per kind and end however often the run repeats
 * or overlaps. Call it on a schedule (a daily cron job running a script). Needs `mailing({ ... })`
 * in the config. The run stops at a refused account, a spent quota and (unless `stopOnRetryLater`
 * is false) the first mail the provider could not take now; the next run resumes. A database
 * failure propagates, and so does a `limit` that is not a whole number of at least 1.
 */
export async function sendAccessReminders(ctx: ModuleContext<Queryable>, options: SendAccessRemindersOptions = {}): Promise<AccessReminderSummary> {
  const { catchUpDays, buildMail, getScope = getDefaultScope, pauseMs = DEFAULT_REMINDER_PAUSE_MS, onDelivery, ...runOptions } = options;
  const due = await findAccessReminders(ctx, catchUpDays === undefined ? {} : { catchUpDays });
  const messages = getBillingMessages(ctx.config);
  const link = new URL(getBillingRoutes(ctx.config).payment, ctx.config.appOrigin).href;

  // `runDeliveries` builds and delivers one recipient at a time, in order, and reports a delivery before it reads
  // the next recipient: the outcome it reports is always for the reminder built last.
  let built: AccessReminderDelivery | null = null;
  const build = async (reminder: AccessReminderDue): Promise<Delivery | null> => {
    const lastDay = formatLastDay(reminder.endsAt, ctx.config.locale, ctx.config.timezone);
    const defaultMail = renderAccessReminderMail(messages, { kind: reminder.kind, lastDay, link });
    const mail = buildMail === undefined ? defaultMail : await buildMail({ reminder, lastDay, link, mail: defaultMail, ctx });
    if (mail === null) return null;
    const scope = getScope(reminder);
    built = { accountId: reminder.userId, kind: reminder.kind, scope };
    return { scope, mail: { to: reminder.email, ...mail } };
  };
  const report = (outcome: DeliveryOutcome): void => {
    // A delivery is only reported after its recipient was built.
    if (built === null) throw new Error("@softure-ai/billing: a reminder delivery was reported before any was built");
    onDelivery?.(outcome, built);
  };
  const run = await runDeliveries(ctx, { recipients: due, build }, { ...runOptions, pauseMs, ...(onDelivery === undefined ? {} : { onDelivery: report }) });
  return { due: due.length, ...run };
}
