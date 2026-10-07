// Campaigns: one list mail to many recipients through the delivery ledger. The campaign row pins
// the content (a hash of kind, subject and bodies), so a re-run with the same id sends the rest of
// the same mail and nothing twice; other content under that id is refused.
import { createHash } from "node:crypto";
import { err, ok, type Result } from "@softure-ai/core";
import { and, eq, inArray } from "drizzle-orm";
import type { MailingErrorCode } from "../contract.js";
import { campaigns, deliveries } from "../schema.js";
import { getCampaignProblems, type CampaignContent } from "./campaign-file.js";
import { deliverOnce, type DeliverOptions, type DeliveryContext, type DeliveryOutcome } from "./deliveries.js";
import { isSuppressed } from "./suppressions.js";
import { getRecipientKey } from "./unsubscribe-link.js";

/** Rejections the provider answered (the others never left the process). */
const PROVIDER_REASONS: ReadonlySet<MailingErrorCode> = new Set(["mailing.rejected", "mailing.unavailable"]);

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
}

export interface SendCampaignOptions extends DeliverOptions {
  /** Pause after every mail that reached the provider, for its rate limit. Default 0. */
  readonly pauseMs?: number;
  /** Called after every recipient, e.g. for progress output. Never receives the address. */
  readonly onDelivery?: (outcome: DeliveryOutcome) => void;
  readonly sleep?: (ms: number) => Promise<void>;
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
  assertCampaign(content);
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
 * unsubscribed are rejected (`mailing.suppressed`) and never retried. Throws on a database failure.
 */
export async function sendCampaign(
  ctx: DeliveryContext,
  input: { readonly campaign: CampaignContent; readonly recipients: Iterable<string> | AsyncIterable<string> },
  options: SendCampaignOptions = {},
): Promise<Result<CampaignSummary, CampaignErrorCode>> {
  const { pauseMs = 0, onDelivery, sleep = wait, ...deliverOptions } = options;
  const { campaign } = input;
  const registered = await registerCampaign(ctx, campaign);
  if (!registered.ok) return registered;

  const counts = { sent: 0, done: 0, inFlight: 0, retryLater: 0, rejected: emptyRejections() };
  const seen = new Set<string>();
  const scope = `campaign:${campaign.id}`;
  for await (const address of input.recipients) {
    const recipientKey = getRecipientKey(address);
    if (seen.has(recipientKey)) continue;
    seen.add(recipientKey);

    const html = campaign.html === null ? {} : { html: campaign.html };
    const outcome = await deliverOnce(
      ctx,
      { scope, campaignId: campaign.id, mail: { to: address, subject: campaign.subject, text: campaign.text, kind: campaign.kind, ...html } },
      deliverOptions,
    );
    countOutcome(counts, outcome);
    onDelivery?.(outcome);
    const reachedProvider = outcome.status === "sent" || outcome.status === "retry-later" || (outcome.status === "rejected" && PROVIDER_REASONS.has(outcome.reason));
    if (reachedProvider && pauseMs > 0) await sleep(pauseMs);
  }
  return ok({ recipients: seen.size, ...counts });
}

export interface CampaignPlan {
  readonly recipients: number;
  /** Already closed by an earlier run. */
  readonly done: number;
  /** Not closed yet, but unsubscribed: they will be rejected without a send. */
  readonly suppressed: number;
  /** Would be sent now. */
  readonly toSend: number;
  /** The campaign id is stored with other content: a real run would be refused. */
  readonly contentChanged: boolean;
}

/** What `sendCampaign` would do, without writing or sending anything. Throws on a database failure. */
export async function planCampaign(
  ctx: DeliveryContext,
  input: { readonly campaign: CampaignContent; readonly recipients: Iterable<string> | AsyncIterable<string> },
): Promise<CampaignPlan> {
  const { campaign } = input;
  assertCampaign(campaign);
  const stored = await ctx.db.select({ contentHash: campaigns.contentHash }).from(campaigns).where(eq(campaigns.id, campaign.id)).limit(1);
  const contentChanged = stored[0] !== undefined && stored[0].contentHash !== getCampaignContentHash(campaign);

  const addresses = new Map<string, string>();
  for await (const address of input.recipients) {
    const key = getRecipientKey(address);
    if (!addresses.has(key)) addresses.set(key, address);
  }
  const closed = new Set<string>();
  const keys = [...addresses.keys()];
  for (let start = 0; start < keys.length; start += 1_000) {
    const rows = await ctx.db
      .select({ recipientKey: deliveries.recipientKey })
      .from(deliveries)
      .where(and(eq(deliveries.scope, `campaign:${campaign.id}`), inArray(deliveries.status, ["sent", "rejected"]), inArray(deliveries.recipientKey, keys.slice(start, start + 1_000))));
    rows.forEach((row) => closed.add(row.recipientKey));
  }
  let suppressed = 0;
  for (const [key, address] of addresses) {
    if (!closed.has(key) && (await isSuppressed(ctx, address))) suppressed += 1;
  }
  return { recipients: addresses.size, done: closed.size, suppressed, toSend: addresses.size - closed.size - suppressed, contentChanged };
}

function assertCampaign(content: CampaignContent): void {
  const problems = getCampaignProblems(content);
  if (problems.length > 0) throw new Error(`@softure-ai/mailing: campaign "${content.id}" cannot be sent: ${problems.join("; ")}`);
}

function emptyRejections(): Record<MailingErrorCode, number> {
  return { "mailing.invalid_input": 0, "mailing.rejected": 0, "mailing.unavailable": 0, "mailing.suppressed": 0, "mailing.provider_refused": 0, "mailing.quota_exceeded": 0 };
}

function countOutcome(
  counts: { sent: number; done: number; inFlight: number; retryLater: number; rejected: Record<MailingErrorCode, number> },
  outcome: DeliveryOutcome,
): void {
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
      counts.retryLater += 1;
      return;
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
