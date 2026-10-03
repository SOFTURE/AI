"use client";

import type { Locale } from "@softure-ai/core";
import { Button, Checkbox, type ClassNames, createSlotClassGetter, FormError, PasswordField } from "@softure-ai/ui";
import { useActionState } from "react";
import { type DeleteAccountField, type DeleteAccountFormState, INITIAL_DELETE_ACCOUNT_STATE } from "../contract.js";
import { getPrivacyErrorMessage, type PrivacyMessages } from "../messages/index.js";

// The account deletion form. It submits straight to its server action through `useActionState`,
// so it works without JavaScript and the redirect after a deletion is followed. It asks for the
// current password and an explicit confirmation. Copy comes from the module's messages; styling
// only from @softure-ai/ui classes and tokens.

export type DeleteAccountAction = (previous: DeleteAccountFormState, formData: FormData) => Promise<DeleteAccountFormState>;

export type DeleteAccountFormSlot = "root" | "description" | "form";

export interface DeleteAccountFormProps {
  readonly action: DeleteAccountAction;
  readonly messages: PrivacyMessages;
  /** Locale of the built-in copy of the ui primitives. */
  readonly locale?: Locale;
  readonly classNames?: ClassNames<DeleteAccountFormSlot>;
  readonly unstyled?: boolean;
}

const DEFAULT_CLASSES: Readonly<Record<DeleteAccountFormSlot, string>> = {
  root: "sft:flex sft:flex-col sft:gap-3 sft:font-sans",
  description: "sft:m-0 sft:text-sm sft:text-muted",
  form: "sft:flex sft:flex-col sft:gap-3",
};

export function DeleteAccountForm({ action, messages, locale, classNames, unstyled }: DeleteAccountFormProps) {
  const [state, formAction, isPending] = useActionState(action, INITIAL_DELETE_ACCOUNT_STATE);
  const slot = createSlotClassGetter({ defaults: DEFAULT_CLASSES, classNames, unstyled });
  const message = state.error === undefined ? undefined : getPrivacyErrorMessage(messages, state.error);
  const errorAt = (field: DeleteAccountField) => (state.field === field ? message : undefined);
  return (
    <div className={slot("root")}>
      <p className={slot("description")}>{messages.delete.description}</p>
      <form action={formAction} className={slot("form")}>
        <PasswordField
          name="password"
          label={messages.delete.password}
          autoComplete="current-password"
          error={errorAt("password")}
          unstyled={unstyled}
          locale={locale}
        />
        <Checkbox name="confirm" label={messages.delete.confirm} required error={errorAt("confirm")} unstyled={unstyled} />
        <FormError message={state.field === undefined ? message : undefined} unstyled={unstyled} />
        <Button type="submit" variant="danger" fullWidth pending={isPending} unstyled={unstyled}>
          {isPending ? messages.delete.pending : messages.delete.submit}
        </Button>
      </form>
    </div>
  );
}
