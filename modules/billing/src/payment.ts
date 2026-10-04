// The contract between the billing module and a payment provider: the manual adapter here, a card
// or transfer provider later (MO-3). The module validates the request and counts the attempt; the
// provider starts the payment and says where the buyer goes next. Access is granted afterwards,
// through `grantPlan` (an admin for manual payments, a verified webhook for a provider).
import type { Err, ModuleContext, Ok } from "@softure-ai/core";
import type { Queryable } from "@softure-ai/db";
import type { Plan, PlanPrice } from "./contract.js";

/** The signed-in account that pays. */
export interface PaymentAccount {
  readonly id: string;
  readonly email: string;
}

/** What an invoice needs, as the buyer typed it (trimmed). */
export interface InvoiceDetails {
  /** A person's or a company's name. */
  readonly name: string;
  /** A tax number such as a Polish NIP or an EU VAT id; null when not given. */
  readonly taxId: string | null;
  readonly address: string;
}

export interface PaymentRequest {
  readonly plan: Plan;
  readonly account: PaymentAccount;
  /** The details the payment page asked for; null when the provider collects its own. */
  readonly invoice: InvoiceDetails | null;
  /** The payment page as an absolute URL, where a hosted checkout sends the buyer back. */
  readonly returnUrl: string;
}

/** Where the buyer goes next. */
export type PaymentStart =
  /** A hosted checkout (e.g. a provider's payment page); the browser is sent there. */
  | { readonly type: "redirect"; readonly url: string }
  /** The request was handed over (e.g. an invoice requested); access follows once it is paid. */
  | { readonly type: "requested" };

export type PaymentContext = ModuleContext<Queryable>;

/** A payment adapter for `billing({ payment })`, e.g. `manual({ onRequest })`. */
export interface PaymentProvider {
  /** A short lowercase name for logs, e.g. `manual`. */
  readonly name: string;
  /** Whether the payment page asks for invoice details before `startPayment`. */
  readonly collectsInvoiceDetails: boolean;
  /**
   * Whether `startPayment` hands a request to the owner and answers `requested` (the manual
   * adapter) rather than sending the buyer to a checkout. Such a request is stored before the
   * call, and the call is made once per open request: asking again only refreshes the stored one.
   */
  readonly handsOverRequests: boolean;
  /**
   * Starts paying for `request.plan`. An expected failure (the provider refused, a notification
   * could not be sent) is `billing.payment_failed`; anything thrown is a bug or an outage.
   */
  startPayment(ctx: PaymentContext, request: PaymentRequest): Promise<Ok<PaymentStart> | Err<"billing.payment_failed">>;
  /**
   * Why the provider cannot charge `price` (e.g. a fraction of its currency's unit), or null when it
   * can. Run for every plan when the config loads, so the deployer meets it, not the buyer.
   */
  checkPrice?(price: PlanPrice): string | null;
}

export function isPaymentProvider(value: unknown): value is PaymentProvider {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<Record<keyof PaymentProvider, unknown>>;
  return (
    typeof candidate.name === "string" &&
    candidate.name !== "" &&
    typeof candidate.collectsInvoiceDetails === "boolean" &&
    typeof candidate.handsOverRequests === "boolean" &&
    typeof candidate.startPayment === "function" &&
    (candidate.checkPrice === undefined || typeof candidate.checkPrice === "function")
  );
}
