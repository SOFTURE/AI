"use client";

import { formatMessage, type Locale } from "@softure-ai/core";
import { Button, type ClassNames, createSlotClassGetter, FormError, TextField } from "@softure-ai/ui";
import { useActionState } from "react";
import { INITIAL_PAYMENT_FORM_STATE, type PaymentFormState } from "../contract.js";
import { getInvoiceFieldLimit, INVOICE_FIELDS, INVOICE_LIMITS, PLAN_FIELD } from "../fields.js";
import { getBillingErrorMessage, type BillingMessages } from "../messages/index.js";

// The form that starts paying for the chosen plan. With a provider that needs them (the manual
// adapter) it asks for the invoice details; otherwise it is one button that sends the buyer to the
// provider's checkout. It submits straight to its server action through `useActionState`, so it
// works before (and without) JavaScript; a requested invoice shows the confirmation instead.

export type PaymentFormAction = (previous: PaymentFormState, formData: FormData) => Promise<PaymentFormState>;

export type PaymentFormSlot = "root" | "form" | "notice";

export interface PaymentFormProps {
  readonly action: PaymentFormAction;
  readonly planId: string;
  /** The plan's name in the app's locale, for the confirmation. */
  readonly planName: string;
  /** The buyer's address, for the confirmation. */
  readonly email: string;
  /** Asks for the invoice details (the manual adapter); else one checkout button. */
  readonly collectsInvoiceDetails: boolean;
  readonly messages: BillingMessages;
  /** Locale of the built-in copy of the ui primitives. */
  readonly locale?: Locale;
  readonly classNames?: ClassNames<PaymentFormSlot>;
  readonly unstyled?: boolean;
}

const DEFAULT_CLASSES: Readonly<Record<PaymentFormSlot, string>> = {
  root: "sft:flex sft:flex-col sft:gap-3 sft:font-sans",
  form: "sft:flex sft:flex-col sft:gap-3",
  notice: "sft:m-0 sft:text-sm sft:text-success",
};

export function PaymentForm({ action, planId, planName, email, collectsInvoiceDetails, messages, locale, classNames, unstyled }: PaymentFormProps) {
  const [state, formAction, isPending] = useActionState(action, INITIAL_PAYMENT_FORM_STATE);
  const slot = createSlotClassGetter({ defaults: DEFAULT_CLASSES, classNames, unstyled });
  if (state.status === "requested") {
    return (
      <div className={slot("root")}>
        <p role="status" className={slot("notice")}>
          {formatMessage(messages.payment.requested, { plan: planName, email })}
        </p>
      </div>
    );
  }

  const copy = messages.payment;
  const values = state.values ?? {};
  const fieldError = (name: string): string | undefined => {
    const code = state.fieldErrors?.[name];
    if (code === undefined) return undefined;
    const limit = getInvoiceFieldLimit(name);
    return formatMessage(getBillingErrorMessage(messages, code), limit === undefined ? {} : { max: limit });
  };
  const hasFieldErrors = Object.keys(state.fieldErrors ?? {}).length > 0;
  const formError = state.error === undefined || hasFieldErrors ? undefined : getBillingErrorMessage(messages, state.error);
  const submitLabel = collectsInvoiceDetails ? copy.requestInvoice : copy.checkout;
  return (
    <div className={slot("root")}>
      <form action={formAction} className={slot("form")}>
        <input type="hidden" name={PLAN_FIELD} value={planId} />
        {collectsInvoiceDetails ? (
          <>
            <TextField
              name={INVOICE_FIELDS.name}
              label={copy.fields.name}
              autoComplete="name"
              required
              maxLength={INVOICE_LIMITS.name}
              defaultValue={values[INVOICE_FIELDS.name] ?? ""}
              error={fieldError(INVOICE_FIELDS.name)}
              locale={locale}
              unstyled={unstyled}
            />
            <TextField
              name={INVOICE_FIELDS.taxId}
              label={copy.fields.taxId}
              maxLength={INVOICE_LIMITS.taxId}
              defaultValue={values[INVOICE_FIELDS.taxId] ?? ""}
              error={fieldError(INVOICE_FIELDS.taxId)}
              locale={locale}
              unstyled={unstyled}
            />
            <TextField
              name={INVOICE_FIELDS.address}
              label={copy.fields.address}
              autoComplete="street-address"
              required
              maxLength={INVOICE_LIMITS.address}
              defaultValue={values[INVOICE_FIELDS.address] ?? ""}
              error={fieldError(INVOICE_FIELDS.address)}
              locale={locale}
              unstyled={unstyled}
            />
          </>
        ) : null}
        <FormError message={formError} unstyled={unstyled} />
        <Button type="submit" variant="primary" fullWidth pending={isPending} unstyled={unstyled}>
          {isPending ? copy.pending : submitLabel}
        </Button>
      </form>
    </div>
  );
}
