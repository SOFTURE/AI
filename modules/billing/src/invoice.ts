// Invoice details as the payment form sends them, parsed at the boundary by a zod schema: each
// field trimmed, the name and the address required, each within its limit, and no control
// characters (Unicode Cc: line breaks, tabs, escapes) anywhere, so a name cannot add lines to the
// owner's mail. Every field problem has its own code, so the form says what to fix.
import { err, ok, type Err, type Ok } from "@softure-ai/core";
import { z } from "zod";
import { INVOICE_FIELDS, INVOICE_LIMITS, type InvoiceField } from "./fields.js";
import type { InvoiceDetails } from "./payment.js";

/** Invoice details as the form sent them, untrimmed. */
export interface InvoiceInput {
  readonly name: string;
  readonly taxId: string;
  readonly address: string;
}

/** Why one invoice field was refused. */
export type InvoiceFieldErrorCode =
  /** The name or the address is empty. */
  | "billing.invoice_field_required"
  /** Longer than `INVOICE_LIMITS` allows the field. */
  | "billing.invoice_field_too_long"
  /** A line break, a tab or another control character. */
  | "billing.invoice_field_control_characters";

export type InvoiceDetailsError = Err<"billing.invoice_details_invalid"> & {
  readonly fieldErrors: Readonly<Partial<Record<InvoiceField, InvoiceFieldErrorCode>>>;
};

const CONTROL_CHARACTER = /\p{Cc}/u;

function createFieldSchema(limit: number, isRequired: boolean) {
  return z
    .string()
    .trim()
    .refine((value) => !CONTROL_CHARACTER.test(value), { message: "billing.invoice_field_control_characters", abort: true })
    .refine((value) => !isRequired || value !== "", { message: "billing.invoice_field_required", abort: true })
    .refine((value) => value.length <= limit, { message: "billing.invoice_field_too_long", abort: true });
}

export const invoiceDetailsSchema = z.strictObject({
  name: createFieldSchema(INVOICE_LIMITS.name, true),
  taxId: createFieldSchema(INVOICE_LIMITS.taxId, false).transform((taxId) => (taxId === "" ? null : taxId)),
  address: createFieldSchema(INVOICE_LIMITS.address, true),
});

/** Trimmed invoice details, or the first problem of each field that has one. */
export function parseInvoiceDetails(input: InvoiceInput): Ok<InvoiceDetails> | InvoiceDetailsError {
  const parsed = invoiceDetailsSchema.safeParse({ name: input.name, taxId: input.taxId, address: input.address });
  if (parsed.success) return ok(parsed.data);
  const fieldErrors: Partial<Record<InvoiceField, InvoiceFieldErrorCode>> = {};
  for (const issue of parsed.error.issues) {
    const key = issue.path[0] as keyof typeof INVOICE_FIELDS;
    // Each refinement's message is one of the codes above; the first problem of a field wins.
    fieldErrors[INVOICE_FIELDS[key]] ??= issue.message as InvoiceFieldErrorCode;
  }
  return { ...err("billing.invoice_details_invalid"), fieldErrors };
}
