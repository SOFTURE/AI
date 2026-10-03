// The manual payment adapter: the buyer asks for an invoice on the payment page, the app hands the
// request to its owner (`onRequest`: a mail, a ticket), and the owner grants the plan in the admin
// page once the invoice is paid. Nothing is charged here; `startPayment` stores the request it
// hands over, so the admin page lists it.
import { err, ok, type Err, type ErrorCode, type Ok } from "@softure-ai/core";
import type { PaymentContext, PaymentProvider, PaymentRequest } from "./payment.js";

export interface ManualPaymentOptions {
  /**
   * Hands a request to the owner. An `Err` tells the buyer the request did not go through
   * (`billing.payment_failed`, its code is logged); a throw is reported as an unexpected failure.
   */
  readonly onRequest: (request: PaymentRequest, ctx: PaymentContext) => Promise<Ok<undefined> | Err<ErrorCode>>;
}

/** `billing({ payment: manual({ onRequest }) })`: invoices requested by the buyer, access granted by an admin. */
export function manual(options: ManualPaymentOptions): PaymentProvider {
  return {
    name: "manual",
    collectsInvoiceDetails: true,
    async startPayment(ctx, request) {
      const handed = await options.onRequest(request, ctx);
      if (!handed.ok) {
        console.error(`@softure-ai/billing: the manual payment request for plan "${request.plan.id}" was not handed over: ${handed.error}`);
        return err("billing.payment_failed");
      }
      return ok({ type: "requested" });
    },
  };
}
