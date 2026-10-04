// Invoice requests in billing: stored before a provider hands a request over (the manual adapter),
// listed in the admin page until the admin grants or dismisses them or they expire. One open
// request per account and plan: asking again refreshes its details and price. The hand-over is
// claimed on the row (`handed_over_at`), so an open request reaches the owner once, and a failed
// hand-over is released for the next ask. Closing a request clears its invoice details, which are
// personal data the app no longer needs (the migration's CHECK holds closed rows empty).
import { users } from "@softure-ai/auth";
import { err, ok, type Err, type Ok } from "@softure-ai/core";
import type { Queryable } from "@softure-ai/db";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import type { PlanPrice } from "../contract.js";
import type { InvoiceDetails } from "../payment.js";
import { paymentRequests } from "../schema.js";
import type { BillingContext } from "./entitlements.js";
import { isUuid } from "./user-id.js";

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
 * for the same plan (its details, price and time; whether it was handed over stays). Returns the
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
 * or null when it was handed over (or is being handed over) already, or is no longer open. A
 * conditional update, so two asks at once hand it over once. Database errors propagate.
 */
export async function claimHandOver(ctx: Pick<BillingContext, "db" | "clock">, requestId: string): Promise<Date | null> {
  const now = ctx.clock.now();
  const [claimed] = await ctx.db
    .update(paymentRequests)
    .set({ handedOverAt: now })
    .where(and(eq(paymentRequests.id, requestId), eq(paymentRequests.status, "open"), isNull(paymentRequests.handedOverAt)))
    .returning();
  return claimed === undefined ? null : now;
}

/**
 * Gives back a claim whose hand-over failed, so the next ask tries again. Only the claim made at
 * `claimedAt` is cleared, never a later one. Database errors propagate.
 */
export async function releaseHandOver(ctx: Pick<BillingContext, "db">, requestId: string, claimedAt: Date): Promise<void> {
  await ctx.db
    .update(paymentRequests)
    .set({ handedOverAt: null })
    .where(and(eq(paymentRequests.id, requestId), eq(paymentRequests.handedOverAt, claimedAt)));
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

/** A stored price, or null when the row has none (a CHECK stores both or neither). */
export function readPrice(amount: number | null, currency: string | null): PlanPrice | null {
  return amount === null || currency === null ? null : { amount, currency };
}
