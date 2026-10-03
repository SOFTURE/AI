// Invoice requests in billing: stored when a provider hands a request over (the manual adapter),
// listed in the admin page until the admin grants or dismisses them. One open request per account
// and plan: asking again refreshes its details. Closing a request clears its invoice details, which
// are personal data the app no longer needs (the migration's CHECK holds closed rows empty).
import { users } from "@softure-ai/auth";
import { err, ok, type Err, type Ok } from "@softure-ai/core";
import type { Queryable } from "@softure-ai/db";
import { and, asc, eq, sql } from "drizzle-orm";
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
}

/** An open request, as the admin page lists it. */
export interface OpenPaymentRequest {
  readonly id: string;
  readonly userId: string;
  readonly email: string;
  readonly planId: string;
  readonly invoice: InvoiceDetails | null;
  readonly requestedAt: Date;
}

/** The columns that close a request: its status, when, and no invoice details any more. */
export function getClosedRequestColumns(status: "granted" | "dismissed", now: Date) {
  return { status, closedAt: now, invoiceName: null, invoiceTaxId: null, invoiceAddress: null };
}

/**
 * Stores a request handed over to the owner, or refreshes the account's open request for the same
 * plan (its details and time). Returns the request's id. Database errors propagate.
 */
export async function recordPaymentRequest(ctx: Pick<BillingContext, "db" | "clock">, input: RecordPaymentRequestInput): Promise<string> {
  const now = ctx.clock.now();
  const details = { invoiceName: input.invoice?.name ?? null, invoiceTaxId: input.invoice?.taxId ?? null, invoiceAddress: input.invoice?.address ?? null };
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
      requestedAt: paymentRequests.requestedAt,
    })
    .from(paymentRequests)
    .innerJoin(users, eq(users.id, paymentRequests.userId))
    .where(eq(paymentRequests.status, "open"))
    .orderBy(asc(paymentRequests.requestedAt), asc(paymentRequests.id))
    .limit(limit);
  return rows.map(({ invoiceName, invoiceTaxId, invoiceAddress, ...row }) => ({
    ...row,
    invoice: invoiceName === null || invoiceAddress === null ? null : { name: invoiceName, taxId: invoiceTaxId, address: invoiceAddress },
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
