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

/** The admin page's hidden fields: the request a button grants or dismisses, the grant one revokes. */
export const REQUEST_FIELD = "request";
export const GRANT_FIELD = "grant";

/** The admin page's parameter that names the account whose history it shows (its id, never its email). */
export const ACCOUNT_PARAM = "account";
