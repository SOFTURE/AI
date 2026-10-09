// Campaigns: one list mail to many recipients through the delivery ledger. The campaign row pins
// the content (a hash of kind, subject and bodies), so a re-run with the same id sends the rest of
// the same mail and nothing twice; other content under that id is refused. A run stops at the first
// failure about the sending account (refused key, spent quota), leaving the rest for the next run, and
// after `limit` mails reached the provider, counting the rest for the next run.
import { createHash } from "node:crypto";
import { err, ok, type Result, type SoftureConfig } from "@softure-ai/core";
import { and, eq, inArray } from "drizzle-orm";
import type { CampaignRecipient, MailingErrorCode } from "../contract.js";
import { campaigns, deliveries } from "../schema.js";
import { getCampaignProblems, type CampaignContent } from "./campaign-file.js";
import { deliverOnce, type DeliverOptions, type DeliveryContext, type DeliveryOutcome, type HaltingErrorCode } from "./deliveries.js";
import { getMailingOptions } from "./options.js";
import { isSuppressed } from "./suppressions.js";
import { getRecipientKey } from "./unsubscribe-link.js";

/** Rejections the provider answered (the others never left the process). */
const PROVIDER_REASONS: ReadonlySet<MailingErrorCode> = new Set(["mailing.rejected", "mailing.unavailable"]);

/** Why a run stopped before the end of the list. */
export interface CampaignHalt {
  readonly reason: HaltingErrorCode;
  readonly httpStatus?: number;
}

/** The campaign id is taken by other content. Give the new content a new id. */
export type CampaignErrorCode = "mailing.campaign_changed";

export interface CampaignSummary {
  /** Distinct recipients in the list (addresses that differ only in case or spaces count once). */
  readonly recipients: number;
  readonly sent: number;
  /** Rejected in this run, by reason. Suppressed recipients are here, under `mailing.suppressed`. */
  readonly rejected: Readonly<Record<MailingErrorCode, number>>;
  /** Closed by an earlier run; nothing sent. */
  readonly done: number;
  /** Claimed by another run that is still sending. */
  readonly inFlight: number;
  /** The provider was unavailable; the next run tries them again. */
  readonly retryLater: number;
  /** Skipped by `filterCampaignRecipient`; nothing stored, so a later run sends to them once they qualify. */
  readonly filtered: number;
  /** Claimed more than `uncertainClaimMs` ago and never closed: their mail may have gone out. */
  readonly uncertain: number;
  /**
   * Set when the run stopped at a failure about the sending account. The recipient it happened to and every one
   * after it were left as they were; run again once the account can send.
   */
  readonly halted: CampaignHalt | null;
  /**
   * Recipients past the `limit` cut that the next run would send to, counted as `planCampaign` counts `toSend`. 0 when
   * the run reached the end of the list; `null` when it halted (the rest of the list was not read).
   */
  readonly remaining: number | null;
}

export interface SendCampaignOptions extends DeliverOptions {
  /** Pause after every mail that reached the provider, for its rate limit. Default 0. */
  readonly pauseMs?: number;
  /** Called after every recipient, e.g. for progress output. Never receives the address. */
  readonly onDelivery?: (outcome: DeliveryOutcome) => void;
  readonly sleep?: (ms: number) => Promise<void>;
  /**
   * Most mails this run hands to the provider (sent, rejected by it, or not taken now), e.g. to leave part of a shared
   * daily quota for other mail. Done, unsubscribed, filtered, in-flight and uncertain recipients never count. Once
   * reached, the run reads the rest of the list only to count `remaining`. A whole number of at least 1. Default: no
   * limit.
   */
  readonly limit?: number;
}

/** sha256 (hex) of what a recipient reads: kind, subject, text and HTML. */
export function getCampaignContentHash(content: CampaignContent): string {
  return createHash("sha256").update(JSON.stringify([content.kind, content.subject, content.text, content.html])).digest("hex");
}

/**
 * Records the campaign, or confirms that the stored one has the same content. Throws on a
 * database failure and for content `getCampaignProblems` refuses.
 */
export async function registerCampaign(ctx: DeliveryContext, content: CampaignContent): Promise<Result<undefined, CampaignErrorCode>> {
  assertCampaign(content, ctx.config);
  const contentHash = getCampaignContentHash(content);
  await ctx.db
    .insert(campaigns)
    .values({ id: content.id, kind: content.kind, subject: content.subject, contentHash, createdAt: ctx.clock.now() })
    .onConflictDoNothing();
  const rows = await ctx.db.select({ contentHash: campaigns.contentHash }).from(campaigns).where(eq(campaigns.id, content.id)).limit(1);
  return rows[0]?.contentHash === contentHash ? ok() : err("mailing.campaign_changed");
}

/**
 * Sends `campaign` to every recipient that has no outcome yet, one at a time. Recipients who
 * unsubscribed are rejected (`mailing.suppressed`) and never retried; recipients the module's
 * `filterCampaignRecipient` refuses are skipped. Stops at the first `halted` delivery, and before the recipient
 * after `limit` mails reached the provider. Throws on a database failure, when the filter throws, and (a
 * `RangeError`) for a `limit` that is not a whole number of at least 1.
 */
export async function sendCampaign(
  ctx: DeliveryContext,
  input: { readonly campaign: CampaignContent; readonly recipients: Iterable<string> | AsyncIterable<string> },
  options: SendCampaignOptions = {},
): Promise<Result<CampaignSummary, CampaignErrorCode>> {
  const { pauseMs = 0, onDelivery, sleep = wait, limit, ...deliverOptions } = options;
  if (limit !== undefined && !(Number.isInteger(limit) && limit >= 1)) {
    throw new RangeError(`@softure-ai/mailing: sendCampaign limit must be a whole number of at least 1, got ${String(limit)}`);
  }
  const { campaign } = input;
  const registered = await registerCampaign(ctx, campaign);
  if (!registered.ok) return registered;

  const counts: Counts = { sent: 0, done: 0, inFlight: 0, retryLater: 0, filtered: 0, uncertain: 0, rejected: emptyRejections() };
  const seen = new Set<string>();
  const scope = `campaign:${campaign.id}`;
  const isWanted = createRecipientFilter(ctx, campaign);
  const pastLimit = new Map<string, string>();
  let handedToProvider = 0;
  for await (const address of input.recipients) {
    const recipientKey = getRecipientKey(address);
    if (seen.has(recipientKey)) continue;
    seen.add(recipientKey);
    if (limit !== undefined && handedToProvider >= limit) {
      pastLimit.set(recipientKey, address);
      continue;
    }
    if (!(await isWanted(address, recipientKey))) {
      counts.filtered += 1;
      continue;
    }

    const html = campaign.html === null ? {} : { html: campaign.html };
    const outcome = await deliverOnce(
      ctx,
      { scope, campaignId: campaign.id, mail: { to: address, subject: campaign.subject, text: campaign.text, kind: campaign.kind, ...html } },
      deliverOptions,
    );
    countOutcome(counts, outcome);
    onDelivery?.(outcome);
    if (outcome.status === "halted") {
      // The rest of the list is not even counted as seen: the summary covers what this run reached.
      const httpStatus = outcome.httpStatus === undefined ? {} : { httpStatus: outcome.httpStatus };
      return ok({ recipients: seen.size, ...counts, halted: { reason: outcome.reason, ...httpStatus }, remaining: null });
    }
    const reachedProvider = outcome.status === "sent" || outcome.status === "retry-later" || (outcome.status === "rejected" && PROVIDER_REASONS.has(outcome.reason));
    if (reachedProvider) handedToProvider += 1;
    if (reachedProvider && pauseMs > 0) await sleep(pauseMs);
  }
  const remaining = pastLimit.size === 0 ? 0 : (await countPending(ctx, campaign, pastLimit, deliverOptions)).toSend;
  return ok({ recipients: seen.size, ...counts, halted: null, remaining });
}

/** `filterCampaignRecipient` bound to the campaign, or "everyone" when the app set none. */
function createRecipientFilter(ctx: DeliveryContext, campaign: CampaignContent): (address: string, recipientKey: string) => Promise<boolean> {
  const filter = getMailingOptions(ctx.config).filterCampaignRecipient;
  if (filter === undefined) return () => Promise.resolve(true);
  const target = { id: campaign.id, kind: campaign.kind };
  return (address, recipientKey) => {
    const recipient: CampaignRecipient = { address, recipientKey, campaign: target };
    return filter(recipient, ctx);
  };
}

/**
 * The campaign's recipients from the module's `listCampaignRecipients`, or `null` when the app set none. Throws
 * what the app's function throws.
 */
export async function listConfiguredCampaignRecipients(
  ctx: DeliveryContext,
  campaign: Pick<CampaignContent, "id" | "kind">,
): Promise<Iterable<string> | AsyncIterable<string> | null> {
  const source = getMailingOptions(ctx.config).listCampaignRecipients;
  if (source === undefined) return null;
  return source({ id: campaign.id, kind: campaign.kind }, ctx);
}

export interface CampaignPlan {
  readonly recipients: number;
  /** Already closed by an earlier run. */
  readonly done: number;
  /** Not closed yet, but unsubscribed: they will be rejected without a send. */
  readonly suppressed: number;
  /** Not closed yet, but `filterCampaignRecipient` refuses them: they will be skipped. */
  readonly filtered: number;
  /**
   * Claimed more than `uncertainClaimMs` ago and never closed: skipped unless the run retakes uncertain claims
   * (then they are sent again and counted in `toSend` too).
   */
  readonly uncertain: number;
  /** Would be sent now. */
  readonly toSend: number;
  /** The campaign id is stored with other content: a real run would be refused. */
  readonly contentChanged: boolean;
}

/**
 * What `sendCampaign` would do, without writing or sending anything (the filter runs, and must not write). Throws
 * on a database failure. `toSend` counts uncertain recipients only with `retakeUncertain`.
 */
export async function planCampaign(
  ctx: DeliveryContext,
  input: { readonly campaign: CampaignContent; readonly recipients: Iterable<string> | AsyncIterable<string> },
  options: Pick<DeliverOptions, "uncertainClaimMs" | "retakeUncertain"> = {},
): Promise<CampaignPlan> {
  const { campaign } = input;
  assertCampaign(campaign, ctx.config);
  const stored = await ctx.db.select({ contentHash: campaigns.contentHash }).from(campaigns).where(eq(campaigns.id, campaign.id)).limit(1);
  const contentChanged = stored[0] !== undefined && stored[0].contentHash !== getCampaignContentHash(campaign);

  const addresses = new Map<string, string>();
  for await (const address of input.recipients) {
    const key = getRecipientKey(address);
    if (!addresses.has(key)) addresses.set(key, address);
  }
  const pending = await countPending(ctx, campaign, addresses, options);
  return { recipients: addresses.size, ...pending, contentChanged };
}

type PendingCounts = Pick<CampaignPlan, "done" | "suppressed" | "filtered" | "uncertain" | "toSend">;

/**
 * How the ledger, the filter and the suppression list sort `addresses` (recipient key to address) for the campaign,
 * without writing. Throws on a database failure and when the filter throws.
 */
async function countPending(
  ctx: DeliveryContext,
  campaign: CampaignContent,
  addresses: ReadonlyMap<string, string>,
  options: Pick<DeliverOptions, "uncertainClaimMs" | "retakeUncertain">,
): Promise<PendingCounts> {
  const uncertainBefore = ctx.clock.now().getTime() - (options.uncertainClaimMs ?? getMailingOptions(ctx.config).uncertainClaimMs);
  const closed = new Set<string>();
  const uncertainKeys = new Set<string>();
  const keys = [...addresses.keys()];
  for (let start = 0; start < keys.length; start += 1_000) {
    const rows = await ctx.db
      .select({ recipientKey: deliveries.recipientKey, status: deliveries.status, claimedAt: deliveries.claimedAt })
      .from(deliveries)
      .where(and(eq(deliveries.scope, `campaign:${campaign.id}`), inArray(deliveries.status, ["sent", "rejected", "claimed"]), inArray(deliveries.recipientKey, keys.slice(start, start + 1_000))));
    for (const row of rows) {
      if (row.status !== "claimed") closed.add(row.recipientKey);
      else if (row.claimedAt.getTime() < uncertainBefore) uncertainKeys.add(row.recipientKey);
    }
  }
  const isWanted = createRecipientFilter(ctx, campaign);
  let suppressed = 0;
  let filtered = 0;
  let toSend = 0;
  let uncertain = 0;
  for (const [key, address] of addresses) {
    if (closed.has(key)) continue;
    if (!(await isWanted(address, key))) filtered += 1;
    else if (await isSuppressed(ctx, address)) suppressed += 1;
    else if (uncertainKeys.has(key)) {
      uncertain += 1;
      if (options.retakeUncertain === true) toSend += 1;
    } else toSend += 1;
  }
  return { done: closed.size, suppressed, filtered, uncertain, toSend };
}

function assertCampaign(content: CampaignContent, config: SoftureConfig): void {
  const problems = getCampaignProblems(content, config);
  if (problems.length > 0) throw new Error(`@softure-ai/mailing: campaign "${content.id}" cannot be sent: ${problems.join("; ")}`);
}

function emptyRejections(): Record<MailingErrorCode, number> {
  return { "mailing.invalid_input": 0, "mailing.rejected": 0, "mailing.unavailable": 0, "mailing.suppressed": 0, "mailing.provider_refused": 0, "mailing.quota_exceeded": 0 };
}

interface Counts {
  sent: number;
  done: number;
  inFlight: number;
  retryLater: number;
  filtered: number;
  uncertain: number;
  rejected: Record<MailingErrorCode, number>;
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
      // A halted recipient is left for the next run, like one the provider could not take now.
      counts.retryLater += 1;
      return;
    case "uncertain":
      counts.uncertain += 1;
      return;
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
