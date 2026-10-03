// Form field names shared by the forms (`/ui`) and the actions that read them (`/next`).
export const PLAN_FIELD = "plan";
export const EMAIL_FIELD = "email";

export const INVOICE_FIELDS = {
  name: "invoiceName",
  taxId: "invoiceTaxId",
  address: "invoiceAddress",
} as const;

export type InvoiceField = (typeof INVOICE_FIELDS)[keyof typeof INVOICE_FIELDS];

export const INVOICE_LIMITS = {
  name: 200,
  taxId: 32,
  address: 500,
} as const;

/** The payment page's parameter a hosted checkout returns with: `?checkout=success` or `?checkout=cancelled`. */
export const CHECKOUT_PARAM = "checkout";

export const CHECKOUT_RESULTS = ["success", "cancelled"] as const;

export type CheckoutResult = (typeof CHECKOUT_RESULTS)[number];
