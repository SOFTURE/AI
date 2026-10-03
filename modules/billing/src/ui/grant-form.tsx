"use client";

import type { Locale } from "@softure-ai/core";
import { Button, type ClassNames, createSlotClassGetter, FormError, SelectField, type SelectOption, TextField } from "@softure-ai/ui";
import { useActionState } from "react";
import { INITIAL_GRANT_FORM_STATE, type GrantFormState } from "../contract.js";
import { EMAIL_FIELD, PLAN_FIELD } from "../fields.js";
import { getBillingErrorMessage, type BillingMessages } from "../messages/index.js";

// The admin form that grants a plan to an account once its payment arrived (the manual adapter):
// the account's email and the plan. It submits straight to its server action, which checks the
// admin role first; after a grant it says what the account has now and stays ready for the next.

export type GrantFormAction = (previous: GrantFormState, formData: FormData) => Promise<GrantFormState>;

export type GrantFormSlot = "root" | "form" | "notice";

export interface GrantFormProps {
  readonly action: GrantFormAction;
  /** The plans to choose from: id and name in the app's locale. */
  readonly plans: readonly SelectOption[];
  readonly messages: BillingMessages;
  /** Locale of the built-in copy of the ui primitives. */
  readonly locale?: Locale;
  readonly classNames?: ClassNames<GrantFormSlot>;
  readonly unstyled?: boolean;
}

const DEFAULT_CLASSES: Readonly<Record<GrantFormSlot, string>> = {
  root: "sft:flex sft:flex-col sft:gap-3 sft:font-sans",
  form: "sft:flex sft:flex-col sft:gap-3",
  notice: "sft:m-0 sft:text-sm sft:text-success",
};

export function GrantForm({ action, plans, messages, locale, classNames, unstyled }: GrantFormProps) {
  const [state, formAction, isPending] = useActionState(action, INITIAL_GRANT_FORM_STATE);
  const slot = createSlotClassGetter({ defaults: DEFAULT_CLASSES, classNames, unstyled });
  const copy = messages.admin;
  const error = state.error === undefined ? undefined : getBillingErrorMessage(messages, state.error);
  const isEmailError = state.error === "billing.account_unknown";
  return (
    <div className={slot("root")}>
      <form action={formAction} className={slot("form")}>
        <TextField
          // A fresh, empty field after each grant; the typed address after an error.
          key={`${state.status}:${state.email ?? ""}`}
          name={EMAIL_FIELD}
          type="email"
          label={copy.email}
          required
          defaultValue={state.status === "error" ? (state.email ?? "") : ""}
          error={isEmailError ? error : undefined}
          locale={locale}
          unstyled={unstyled}
        />
        <SelectField name={PLAN_FIELD} label={copy.plan} options={plans} defaultValue={state.planId} locale={locale} unstyled={unstyled} />
        <FormError message={isEmailError ? undefined : error} unstyled={unstyled} />
        <Button type="submit" variant="primary" pending={isPending} unstyled={unstyled}>
          {isPending ? copy.pending : copy.submit}
        </Button>
      </form>
      {state.status === "granted" ? (
        <p role="status" className={slot("notice")}>
          {state.notice}
        </p>
      ) : null}
    </div>
  );
}
