// Invoice requests in billing: stored before a provider hands a request over (the manual adapter),
// listed in the admin page until the admin grants or dismisses them or they expire. One open
// request per account and plan: asking again refreshes its details and price. The hand-over is
// claimed on the row (`handover_claimed_at`) and recorded once it answered (`handed_over_at`), so
// an open request reaches the owner once; a failed hand-over is released for the next ask, and a
// claim left without an answer (the process stopped) is taken over after a minute. Closing a request clears its invoice details, which are
// personal data the app no longer needs (the migration's CHECK holds closed rows empty).
import { users } from "@softure-ai/auth";
import { err, ok, type Err, type Ok } from "@softure-ai/core";
import type { Queryable } from "@softure-ai/db";
import { and, asc, eq, isNull, lt, lte, or, sql } from "drizzle-orm";
import type { PlanPrice } from "../contract.js";
import type { InvoiceDetails } from "../payment.js";
import { paymentRequests } from "../schema.js";
import type { BillingContext } from "./entitlements.js";
import { getBillingOptions } from "./options.js";
import { isUuid } from "./user-id.js";

const DAY_MS = 24 * 60 * 60 * 1000;

/** How long a hand-over claim blocks other asks: a provider's mail call takes seconds. */
const HANDOVER_CLAIM_TIMEOUT_MS = 60 * 1000;

/** How many open requests the admin page lists by default. */
export const OPEN_REQUESTS_LIMIT = 50;

export interface RecordPaymentRequestInput {
  readonly userId: string;
  readonly planId: string;
  /** Null when the provider collects its own details. */
  readonly invoice: InvoiceDetails | null;
  /** The plan's price now: what the request quotes. */
  readonly price: PlanPrice;
}

/** An open request, as the admin page lists it. */
export interface OpenPaymentRequest {
  readonly id: string;
  readonly userId: string;
  readonly email: string;
  readonly planId: string;
  readonly invoice: InvoiceDetails | null;
  /** The plan's price when it was asked for; null for a request stored before prices were. */
  readonly price: PlanPrice | null;
  readonly requestedAt: Date;
}

/** The columns that close a request: its status, when, and no invoice details any more. */
export function getClosedRequestColumns(status: "granted" | "dismissed" | "expired", now: Date) {
  return { status, closedAt: now, invoiceName: null, invoiceTaxId: null, invoiceAddress: null };
}

/**
 * Stores a request before it is handed over to the owner, or refreshes the account's open request
 * for the same plan (its details, price and time; its hand-over and claim stay). Returns the
 * request's id. Database errors propagate.
 */
export async function recordPaymentRequest(ctx: Pick<BillingContext, "db" | "clock">, input: RecordPaymentRequestInput): Promise<string> {
  const now = ctx.clock.now();
  const details = {
    invoiceName: input.invoice?.name ?? null,
    invoiceTaxId: input.invoice?.taxId ?? null,
    invoiceAddress: input.invoice?.address ?? null,
    amount: input.price.amount,
    currency: input.price.currency,
  };
  const [row] = await ctx.db
    .insert(paymentRequests)
    .values({ userId: input.userId, planId: input.planId, ...details, status: "open", requestedAt: now })
    .onConflictDoUpdate({
      target: [paymentRequests.userId, paymentRequests.planId],
      targetWhere: sql`status = 'open'`,
      set: { ...details, requestedAt: now },
    })
    .returning();
  // An insert or an update of the conflicting row always returns it.
  if (row === undefined) throw new Error("@softure-ai/billing: storing a payment request returned no row");
  return row.id;
}

/**
 * Claims the hand-over of an open request that was not handed over yet: the time it was claimed,
 * or null when it was handed over already, is being handed over (a claim younger than
 * `HANDOVER_CLAIM_TIMEOUT_MS`), or is no longer open. An older claim was left without an answer and
 * is taken over. A conditional update, so two asks at once hand it over once. Database errors
 * propagate.
 */
export async function claimHandOver(ctx: Pick<BillingContext, "db" | "clock">, requestId: string): Promise<Date | null> {
  const now = ctx.clock.now();
  const staleBefore = new Date(now.getTime() - HANDOVER_CLAIM_TIMEOUT_MS);
  const [claimed] = await ctx.db
    .update(paymentRequests)
    .set({ handoverClaimedAt: now })
    .where(
      and(
        eq(paymentRequests.id, requestId),
        eq(paymentRequests.status, "open"),
        isNull(paymentRequests.handedOverAt),
        or(isNull(paymentRequests.handoverClaimedAt), lte(paymentRequests.handoverClaimedAt, staleBefore)),
      ),
    )
    .returning();
  return claimed === undefined ? null : now;
}

/**
 * Records a hand-over that answered: the request is never handed over again, whichever ask holds
 * the claim now. The first record wins. Database errors propagate.
 */
export async function confirmHandOver(ctx: Pick<BillingContext, "db" | "clock">, requestId: string): Promise<void> {
  await ctx.db
    .update(paymentRequests)
    .set({ handedOverAt: ctx.clock.now(), handoverClaimedAt: null })
    .where(and(eq(paymentRequests.id, requestId), isNull(paymentRequests.handedOverAt)));
}

/**
 * Gives back a claim whose hand-over failed, so the next ask tries again. Only the claim made at
 * `claimedAt` is cleared, never a later one. Database errors propagate.
 */
export async function releaseHandOver(ctx: Pick<BillingContext, "db">, requestId: string, claimedAt: Date): Promise<void> {
  await ctx.db
    .update(paymentRequests)
    .set({ handoverClaimedAt: null })
    .where(and(eq(paymentRequests.id, requestId), eq(paymentRequests.handoverClaimedAt, claimedAt)));
}

/** The open requests, oldest first, with each account's email. */
export async function listOpenRequests(ctx: Pick<BillingContext, "db">, limit: number = OPEN_REQUESTS_LIMIT): Promise<readonly OpenPaymentRequest[]> {
  const rows = await ctx.db
    .select({
      id: paymentRequests.id,
      userId: paymentRequests.userId,
      email: users.email,
      planId: paymentRequests.planId,
      invoiceName: paymentRequests.invoiceName,
      invoiceTaxId: paymentRequests.invoiceTaxId,
      invoiceAddress: paymentRequests.invoiceAddress,
      amount: paymentRequests.amount,
      currency: paymentRequests.currency,
      requestedAt: paymentRequests.requestedAt,
    })
    .from(paymentRequests)
    .innerJoin(users, eq(users.id, paymentRequests.userId))
    .where(eq(paymentRequests.status, "open"))
    .orderBy(asc(paymentRequests.requestedAt), asc(paymentRequests.id))
    .limit(limit);
  return rows.map(({ invoiceName, invoiceTaxId, invoiceAddress, amount, currency, ...row }) => ({
    ...row,
    invoice: invoiceName === null || invoiceAddress === null ? null : { name: invoiceName, taxId: invoiceTaxId, address: invoiceAddress },
    price: readPrice(amount, currency),
  }));
}

/** The open request with this id (its account and plan), or undefined. */
export async function findOpenRequest(db: Queryable, requestId: string): Promise<{ readonly userId: string; readonly planId: string } | undefined> {
  if (!isUuid(requestId)) return undefined;
  const [row] = await db
    .select({ userId: paymentRequests.userId, planId: paymentRequests.planId })
    .from(paymentRequests)
    .where(and(eq(paymentRequests.id, requestId), eq(paymentRequests.status, "open")));
  return row;
}

/** Closes an open request without a grant and clears its details; `billing.request_closed` when it is not open. */
export async function dismissPaymentRequest(ctx: Pick<BillingContext, "db" | "clock">, requestId: string): Promise<Ok<undefined> | Err<"billing.request_closed">> {
  if (!isUuid(requestId)) return err("billing.request_closed");
  const [closed] = await ctx.db
    .update(paymentRequests)
    .set(getClosedRequestColumns("dismissed", ctx.clock.now()))
    .where(and(eq(paymentRequests.id, requestId), eq(paymentRequests.status, "open")))
    .returning();
  return closed === undefined ? err("billing.request_closed") : ok();
}

export interface ExpiredRequestsSummary {
  /** Open requests closed as `expired` by this run. */
  readonly expired: number;
}

/**
 * Closes the open requests nobody asked again for in `requests.expireAfterDays` days as `expired`
 * and clears their invoice details: personal data kept no longer than the request waits. Run it
 * daily (a scheduler); a repeated run closes nothing new. Database errors propagate.
 */
export async function expireStaleRequests(ctx: BillingContext): Promise<ExpiredRequestsSummary> {
  const now = ctx.clock.now();
  const { expireAfterDays } = getBillingOptions(ctx.config).requests;
  const cutoff = new Date(now.getTime() - expireAfterDays * DAY_MS);
  const expired = await ctx.db
    .update(paymentRequests)
    .set(getClosedRequestColumns("expired", now))
    .where(and(eq(paymentRequests.status, "open"), lt(paymentRequests.requestedAt, cutoff)))
    .returning();
  return { expired: expired.length };
}

/** A stored price, or null when the row has none (a CHECK stores both or neither). */
export function readPrice(amount: number | null, currency: string | null): PlanPrice | null {
  return amount === null || currency === null ? null : { amount, currency };
}
