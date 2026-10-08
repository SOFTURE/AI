"use client";

import type { Locale } from "@softure-ai/core";
import { Button, type ClassNames, createSlotClassGetter, FormError, TextField } from "@softure-ai/ui";
import { useActionState } from "react";
import { INITIAL_TRIAL_FORM_STATE, type TrialFormState } from "../contract.js";
import { EMAIL_FIELD, TRIAL_LAST_DAY_FIELD } from "../fields.js";
import { getBillingErrorMessage, type BillingMessages } from "../messages/index.js";

// The admin form that extends an account's trial for free: the account's email and the trial's
// new last day. It submits straight to its server action, which checks the admin role first; after
// an extension it says until when the trial lasts and stays ready for the next.

export type TrialFormAction = (previous: TrialFormState, formData: FormData) => Promise<TrialFormState>;

export type TrialFormSlot = "root" | "form" | "notice";

export interface TrialFormProps {
  readonly action: TrialFormAction;
  readonly messages: BillingMessages;
  /** Locale of the built-in copy of the ui primitives. */
  readonly locale?: Locale;
  readonly classNames?: ClassNames<TrialFormSlot>;
  readonly unstyled?: boolean;
}

const DEFAULT_CLASSES: Readonly<Record<TrialFormSlot, string>> = {
  root: "sft:flex sft:flex-col sft:gap-3 sft:font-sans",
  form: "sft:flex sft:flex-col sft:gap-3",
  notice: "sft:m-0 sft:text-sm sft:text-success",
};

export function TrialForm({ action, messages, locale, classNames, unstyled }: TrialFormProps) {
  const [state, formAction, isPending] = useActionState(action, INITIAL_TRIAL_FORM_STATE);
  const slot = createSlotClassGetter({ defaults: DEFAULT_CLASSES, classNames, unstyled });
  const copy = messages.admin.trial;
  const error = state.error === undefined ? undefined : getBillingErrorMessage(messages, state.error);
  const isEmailError = state.error === "billing.account_unknown";
  const isDayError = state.error === "billing.day_invalid" || state.error === "billing.end_not_in_future" || state.error === "billing.trial_not_extended";
  const isError = state.status === "error";
  // A fresh, empty form after each extension; the typed values after an error.
  const key = `${state.status}:${state.email ?? ""}:${state.lastDay ?? ""}`;
  return (
    <div className={slot("root")}>
      <form action={formAction} className={slot("form")}>
        <TextField
          key={`email:${key}`}
          name={EMAIL_FIELD}
          type="email"
          label={copy.email}
          required
          defaultValue={isError ? (state.email ?? "") : ""}
          error={isEmailError ? error : undefined}
          locale={locale}
          unstyled={unstyled}
        />
        <TextField
          key={`day:${key}`}
          name={TRIAL_LAST_DAY_FIELD}
          type="date"
          label={copy.lastDay}
          required
          defaultValue={isError ? (state.lastDay ?? "") : ""}
          error={isDayError ? error : undefined}
          locale={locale}
          unstyled={unstyled}
        />
        <FormError message={isEmailError || isDayError ? undefined : error} unstyled={unstyled} />
        <Button type="submit" variant="primary" pending={isPending} unstyled={unstyled}>
          {isPending ? copy.pending : copy.submit}
        </Button>
      </form>
      {state.status === "extended" ? (
        <p role="status" className={slot("notice")}>
          {state.notice}
        </p>
      ) : null}
    </div>
  );
}
