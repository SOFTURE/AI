// The example's manual payments: an invoice request becomes a mail to the owner, who grants the plan
// at /admin/billing once it is paid (e2e/billing-pricing.spec.ts reads the mail from the outbox).
// A transactional mail through @softure-ai/mailing's server API, so `softure migrate`, which loads
// softure.config.ts outside Next, never imports Next.
import { formatPrice, getLocalizedText, type ManualPaymentOptions } from "@softure-ai/billing";
import { formatMessage, ok } from "@softure-ai/core";
import { sendMail } from "@softure-ai/mailing/server";
import { randomUUID } from "node:crypto";
import { getMessages } from "../messages/index.ts";

/** Where the owner grants plans. */
export const BILLING_ADMIN_PATH = "/admin/billing";

/** `manual({ onRequest })` that mails each request to `ownerEmail`. */
export function mailInvoiceRequestsTo(ownerEmail: string): ManualPaymentOptions["onRequest"] {
  return async (request, ctx) => {
    const { config } = ctx;
    const messages = getMessages(config.locale);
    const plan = getLocalizedText(request.plan.name, config.locale);
    const values = {
      email: request.account.email,
      plan,
      price: formatPrice(request.plan.price, config.locale),
      name: request.invoice?.name ?? "",
      taxId: request.invoice?.taxId ?? messages.invoiceMail.noTaxId,
      address: request.invoice?.address ?? "",
      adminUrl: new URL(BILLING_ADMIN_PATH, config.appOrigin).toString(),
    };
    const sent = await sendMail(
      { config },
      { to: ownerEmail, subject: formatMessage(messages.invoiceMail.subject, values), text: formatMessage(messages.invoiceMail.body, values) },
      // One key per request: a retry of this send (not a second request) is the same mail.
      { idempotencyKey: `example-invoice-request:${request.account.id}:${randomUUID()}` },
    );
    return sent.ok ? ok() : sent;
  };
}
