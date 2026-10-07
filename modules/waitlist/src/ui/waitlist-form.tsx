"use client";

import type { Locale } from "@softure-ai/core";
import { Button, Checkbox, type ClassNames, createSlotClassGetter, FormError, TextField } from "@softure-ai/ui";
import { type ReactNode, useActionState } from "react";
import { INITIAL_WAITLIST_FORM_STATE, type WaitlistFormState } from "../contract.js";
import { EMAIL_FIELD, getScopeFieldName, PLACEMENT_FIELD } from "../fields.js";
import { getWaitlistErrorMessage, type WaitlistMessages } from "../messages/index.js";

// The waitlist form: an email field, one checkbox per consent scope and the submit button. It
// submits straight to its server action through `useActionState`, so it works before (and without)
// JavaScript; after a sign-up it shows the confirmation (or, with double opt-in, where to confirm)
// instead of the form, with the person's unsubscribe link when the action returned one. Copy comes from the
// module's messages and the scope labels the server prepared; styling only from @softure-ai/ui.

export type WaitlistFormAction = (previous: WaitlistFormState, formData: FormData) => Promise<WaitlistFormState>;

export type WaitlistFormSlot = "root" | "form" | "scopes" | "notice" | "unsubscribe";

/** One consent checkbox, prepared on the server. */
export interface WaitlistFormScope {
  readonly id: string;
  /** The statement in the app's copy; may contain links (e.g. to the privacy policy). */
  readonly label: ReactNode;
  /** The form cannot be sent without it. */
  readonly required: boolean;
}

export interface WaitlistFormProps {
  readonly action: WaitlistFormAction;
  readonly scopes: readonly WaitlistFormScope[];
  /** Where the form sits, one of `waitlist({ placements })`. */
  readonly placement: string;
  readonly messages: WaitlistMessages;
  /** Locale of the built-in copy of the ui primitives. */
  readonly locale?: Locale;
  readonly classNames?: ClassNames<WaitlistFormSlot>;
  readonly unstyled?: boolean;
}

const DEFAULT_CLASSES: Readonly<Record<WaitlistFormSlot, string>> = {
  root: "sft:flex sft:flex-col sft:gap-3 sft:font-sans",
  form: "sft:flex sft:flex-col sft:gap-3",
  scopes: "sft:flex sft:flex-col sft:gap-3",
  notice: "sft:m-0 sft:text-sm sft:text-success",
  unsubscribe: "sft:m-0 sft:text-sm sft:text-muted sft:break-words",
};

export function WaitlistForm({ action, scopes, placement, messages, locale, classNames, unstyled }: WaitlistFormProps) {
  const [state, formAction, isPending] = useActionState(action, INITIAL_WAITLIST_FORM_STATE);
  const slot = createSlotClassGetter({ defaults: DEFAULT_CLASSES, classNames, unstyled });
  if (state.status === "ok" || state.status === "confirmation_sent") {
    return (
      <div className={slot("root")}>
        <p role="status" className={slot("notice")}>
          {state.status === "ok" ? messages.form.success : messages.form.confirmationSent}
        </p>
        {state.status === "ok" && state.unsubscribeUrl !== undefined ? (
          <p className={slot("unsubscribe")}>
            {messages.form.unsubscribeHint} <a href={state.unsubscribeUrl}>{messages.form.unsubscribeLink}</a>
          </p>
        ) : null}
      </div>
    );
  }

  const message = state.error === undefined ? undefined : getWaitlistErrorMessage(messages, state.error);
  const checked = new Set(state.scopes ?? []);
  return (
    <div className={slot("root")}>
      <form action={formAction} className={slot("form")}>
        <input type="hidden" name={PLACEMENT_FIELD} value={placement} />
        <TextField
          name={EMAIL_FIELD}
          type="email"
          label={messages.form.email}
          autoComplete="email"
          required
          defaultValue={state.email ?? ""}
          error={state.field === "email" ? message : undefined}
          locale={locale}
          unstyled={unstyled}
        />
        <div className={slot("scopes")}>
          {scopes.map((scope) => (
            <Checkbox
              // Remounted after each answer, so the checked state follows the last submit.
              key={`${scope.id}:${String(checked.has(scope.id))}`}
              name={getScopeFieldName(scope.id)}
              label={scope.label}
              required={scope.required}
              defaultChecked={checked.has(scope.id)}
              unstyled={unstyled}
            />
          ))}
        </div>
        <FormError message={state.field === "email" ? undefined : message} unstyled={unstyled} />
        <Button type="submit" variant="primary" fullWidth pending={isPending} unstyled={unstyled}>
          {isPending ? messages.form.pending : messages.form.submit}
        </Button>
      </form>
    </div>
  );
}
