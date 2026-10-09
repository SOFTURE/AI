// A run of lifecycle mail: one delivery per recipient through the ledger (`deliverOnce`), e.g. every subscription
// whose trial ends this week. The app lists the recipients and builds each mail; the run keeps the ledger's
// at-most-once rule, stops at the first failure about the sending account (refused key, spent quota) and after
// `limit` mails reached the provider, and counts what it did. A dry run reads the same state and writes nothing.
import { TRANSACTIONAL_KIND, type MailingErrorCode } from "../contract.js";
import { deliverOnce, forecastDelivery, type DeliverOptions, type Delivery, type DeliveryContext, type DeliveryForecast, type DeliveryOutcome, type HaltingErrorCode } from "./deliveries.js";
import { getRecipientKey, MIN_UNSUBSCRIBE_SECRET_LENGTH, readUnsubscribeSecrets, UNSUBSCRIBE_SECRET_ENV } from "./unsubscribe-link.js";

/** Rejections the provider answered (the others never left the process). */
const PROVIDER_REASONS: ReadonlySet<MailingErrorCode> = new Set(["mailing.rejected", "mailing.unavailable"]);

export interface DeliveryRunInput<Recipient> {
  readonly recipients: Iterable<Recipient> | AsyncIterable<Recipient>;
  /** The delivery for one recipient (its scope and mail), or `null` to skip them. A throw stops the run. */
  readonly build: (recipient: Recipient) => Delivery | null | Promise<Delivery | null>;
}

export interface RunDeliveriesOptions extends DeliverOptions {
  /** Pause after every mail that reached the provider, for its rate limit. Default 0. */
  readonly pauseMs?: number;
  /**
   * Most mails this run hands to the provider (sent, rejected by it, or not taken now). Once reached, the run reads
   * the rest only to count `remaining`. A whole number of at least 1. Default: no limit.
   */
  readonly limit?: number;
  /** Reads the ledger and the suppression list and sends and writes nothing; `sent` then counts what would go out. */
  readonly dryRun?: boolean;
  /** Called after every delivery of a real run, e.g. for progress output. Never receives the address. */
  readonly onDelivery?: (outcome: DeliveryOutcome) => void;
  readonly sleep?: (ms: number) => Promise<void>;
}

export interface DeliveryRunSummary {
  readonly dryRun: boolean;
  /** Recipients read (past the limit too, but not past a halt). */
  readonly recipients: number;
  /** `build` returned `null`; nothing stored. */
  readonly skipped: number;
  /** Sent in this run; in a dry run, the mails that would reach the provider. */
  readonly sent: number;
  /** Rejected in this run, by reason; suppressed list mail is under `mailing.suppressed`. */
  readonly rejected: Readonly<Record<MailingErrorCode, number>>;
  /** Closed by an earlier run (or, in a dry run, by a delivery earlier in this one); nothing sent. */
  readonly done: number;
  /** Claimed by another run that is still sending. */
  readonly inFlight: number;
  /** The provider was unavailable, or the run halted on it; the next run tries again. */
  readonly retryLater: number;
  /** Claimed more than `uncertainClaimMs` ago and never closed: their mail may have gone out. */
  readonly uncertain: number;
  /** Set when the run stopped at a failure about the sending account; run again once the account can send. */
  readonly halted: { readonly reason: HaltingErrorCode; readonly httpStatus?: number } | null;
  /** Deliveries past the `limit` cut that the next run would send; 0 without a cut, `null` after a halt. */
  readonly remaining: number | null;
}

type Counts = { -readonly [Key in Exclude<keyof DeliveryRunSummary, "dryRun" | "halted" | "remaining" | "rejected">]: number } & { rejected: Record<MailingErrorCode, number> };

/**
 * Builds and delivers one mail per recipient, in order, each at most once per scope and recipient. Throws on a
 * database failure, when `build` throws, like `deliverOnce` for a malformed delivery, at the first list mail when
 * `MAILING_UNSUBSCRIBE_SECRET` is not set (each send would fail and use up an attempt), and (a `RangeError`) for a
 * `limit` that is not a whole number of at least 1.
 */
export async function runDeliveries<Recipient>(ctx: DeliveryContext, input: DeliveryRunInput<Recipient>, options: RunDeliveriesOptions = {}): Promise<DeliveryRunSummary> {
  const { pauseMs = 0, limit, dryRun = false, onDelivery, sleep = wait, ...deliverOptions } = options;
  if (limit !== undefined && !(Number.isInteger(limit) && limit >= 1)) {
    throw new RangeError(`@softure-ai/mailing: runDeliveries limit must be a whole number of at least 1, got ${String(limit)}`);
  }
  const counts: Counts = { recipients: 0, skipped: 0, sent: 0, done: 0, inFlight: 0, retryLater: 0, uncertain: 0, rejected: emptyRejections() };
  // Deliveries this run already sent or would send, so a dry run (and the count past the limit) sees its own effect.
  const reached = new Set<string>();
  let handedToProvider = 0;
  let remaining = 0;
  for await (const recipient of input.recipients) {
    counts.recipients += 1;
    const delivery = await input.build(recipient);
    if (delivery === null) {
      counts.skipped += 1;
      continue;
    }
    assertListMailCanBeSigned(delivery);
    const isPastLimit = limit !== undefined && handedToProvider >= limit;
    if (dryRun || isPastLimit) {
      const forecast = await forecastOnce(ctx, delivery, { options: deliverOptions, reached });
      if (isPastLimit) {
        if (forecast.status === "send") remaining += 1;
        continue;
      }
      countForecast(counts, forecast);
      if (forecast.status === "send") handedToProvider += 1;
      continue;
    }

    const outcome = await deliverOnce(ctx, delivery, deliverOptions);
    countOutcome(counts, outcome);
    onDelivery?.(outcome);
    if (outcome.status === "halted") {
      const httpStatus = outcome.httpStatus === undefined ? {} : { httpStatus: outcome.httpStatus };
      return { dryRun, ...counts, halted: { reason: outcome.reason, ...httpStatus }, remaining: null };
    }
    const reachedProvider = outcome.status === "sent" || outcome.status === "retry-later" || (outcome.status === "rejected" && PROVIDER_REASONS.has(outcome.reason));
    if (outcome.status === "sent") reached.add(getDeliveryKey(delivery));
    if (reachedProvider) handedToProvider += 1;
    if (reachedProvider && pauseMs > 0) await sleep(pauseMs);
  }
  return { dryRun, ...counts, halted: null, remaining };
}

function getDeliveryKey(delivery: Delivery): string {
  return `${delivery.scope}\n${getRecipientKey(delivery.mail.to)}`;
}

/** List mail without the signing secret is a configuration bug: stop before any claim is taken. */
function assertListMailCanBeSigned(delivery: Delivery): void {
  if ((delivery.mail.kind ?? TRANSACTIONAL_KIND) === TRANSACTIONAL_KIND || readUnsubscribeSecrets().current !== null) return;
  throw new Error(`@softure-ai/mailing: runDeliveries sends list mail, which needs ${UNSUBSCRIBE_SECRET_ENV} (at least ${String(MIN_UNSUBSCRIBE_SECRET_LENGTH)} characters)`);
}

/** The forecast, with a delivery this run already sent (or would send) counted as done. */
async function forecastOnce(
  ctx: DeliveryContext,
  delivery: Delivery,
  { options, reached }: { readonly options: DeliverOptions; readonly reached: Set<string> },
): Promise<DeliveryForecast> {
  const key = getDeliveryKey(delivery);
  const forecast = await forecastDelivery(ctx, delivery, options);
  if (forecast.status !== "send") return forecast;
  if (reached.has(key)) return { status: "done" };
  reached.add(key);
  return forecast;
}

function countForecast(counts: Counts, forecast: DeliveryForecast): void {
  switch (forecast.status) {
    case "send":
      counts.sent += 1;
      return;
    case "rejected":
      counts.rejected[forecast.reason] += 1;
      return;
    case "done":
      counts.done += 1;
      return;
    case "in-flight":
      counts.inFlight += 1;
      return;
    case "uncertain":
      counts.uncertain += 1;
      return;
  }
}

function countOutcome(counts: Counts, outcome: DeliveryOutcome): void {
  switch (outcome.status) {
    case "sent":
      counts.sent += 1;
      return;
    case "rejected":
      counts.rejected[outcome.reason] += 1;
      return;
    case "done":
      counts.done += 1;
      return;
    case "in-flight":
      counts.inFlight += 1;
      return;
    case "retry-later":
    case "halted":
      counts.retryLater += 1;
      return;
    case "uncertain":
      counts.uncertain += 1;
      return;
  }
}

function emptyRejections(): Record<MailingErrorCode, number> {
  return { "mailing.invalid_input": 0, "mailing.rejected": 0, "mailing.unavailable": 0, "mailing.suppressed": 0, "mailing.provider_refused": 0, "mailing.quota_exceeded": 0 };
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
