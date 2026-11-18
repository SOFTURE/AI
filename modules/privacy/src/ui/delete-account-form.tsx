"use client";

import { formatMessage, type Locale } from "@softure-ai/core";
import { Button, Checkbox, type ClassNames, createSlotClassGetter, FormError, PasswordField } from "@softure-ai/ui";
import { useActionState } from "react";
import { type DeleteAccountField, type DeleteAccountFormState, INITIAL_DELETE_ACCOUNT_STATE } from "../contract.js";
import { getPrivacyErrorMessage, getReauthenticationMessages, type PrivacyMessages } from "../messages/index.js";

// The account deletion form. It submits straight to its server action through `useActionState`,
// so it works without JavaScript and the redirect after a deletion is followed. It asks for the
// current password and an explicit confirmation. An account that signs in with a provider can
// confirm by signing in with it again instead (one small form per provider, posting `provider` and
// `next` to the provider sign-in action); right after that sign-in the password field goes away.
// Copy comes from the module's messages; styling only from @softure-ai/ui classes and tokens.

export type DeleteAccountAction = (previous: DeleteAccountFormState, formData: FormData) => Promise<DeleteAccountFormState>;

export type DeleteAccountFormSlot = "root" | "description" | "notice" | "form" | "reauthentication" | "reauthenticationLead";

export interface DeleteAccountProvider {
  readonly id: string;
  /** Shown in `messages.delete.confirmWith`, e.g. GitHub. */
  readonly name: string;
}

/** How the signed-in user can confirm with a provider; `getDeleteAccountReauthentication` of `/next` builds it. */
export interface DeleteAccountReauthentication {
  /** The configured providers the account signs in with. */
  readonly providers: readonly DeleteAccountProvider[];
  /** The provider whose recent sign-in opened this session: the deletion needs no password then. */
  readonly recentProvider: DeleteAccountProvider | null;
  /** The provider sign-in start action (`oidcSignInAction` of `@softure-ai/auth/next`). */
  readonly signInAction: (formData: FormData) => void | Promise<void>;
  /** Where the sign-in comes back to: this page. */
  readonly next: string;
  /** False when the app has no passwords: the password field is left out. */
  readonly isPasswordEnabled: boolean;
}

export interface DeleteAccountFormProps {
  readonly action: DeleteAccountAction;
  readonly messages: PrivacyMessages;
  /** Without it, the form asks for the password only. */
  readonly reauthentication?: DeleteAccountReauthentication;
  /** Locale of the built-in copy of the ui primitives. */
  readonly locale?: Locale;
  readonly classNames?: ClassNames<DeleteAccountFormSlot>;
  readonly unstyled?: boolean;
}

const DEFAULT_CLASSES: Readonly<Record<DeleteAccountFormSlot, string>> = {
  root: "sft:flex sft:flex-col sft:gap-3 sft:font-sans",
  description: "sft:m-0 sft:text-sm sft:text-muted",
  notice: "sft:m-0 sft:text-sm sft:text-success",
  form: "sft:flex sft:flex-col sft:gap-3",
  reauthentication: "sft:flex sft:flex-col sft:gap-2",
  reauthenticationLead: "sft:m-0 sft:text-sm sft:text-muted",
};

export function DeleteAccountForm({ action, messages, reauthentication, locale, classNames, unstyled }: DeleteAccountFormProps) {
  const [state, formAction, isPending] = useActionState(action, INITIAL_DELETE_ACCOUNT_STATE);
  const slot = createSlotClassGetter({ defaults: DEFAULT_CLASSES, classNames, unstyled });
  const copy = getReauthenticationMessages(messages);
  const message = state.error === undefined ? undefined : getPrivacyErrorMessage(messages, state.error);
  const errorAt = (field: DeleteAccountField) => (state.field === field ? message : undefined);
  const recent = reauthentication?.recentProvider ?? null;
  const hasPasswordField = recent === null && (reauthentication?.isPasswordEnabled ?? true);
  const providers = recent === null ? (reauthentication?.providers ?? []) : [];
  return (
    <div className={slot("root")}>
      <p className={slot("description")}>{messages.delete.description}</p>
      {recent === null ? null : (
        <p className={slot("notice")} role="status">
          {formatMessage(copy.confirmedWith, { provider: recent.name })}
        </p>
      )}
      {reauthentication === undefined || providers.length === 0 ? null : (
        <div className={slot("reauthentication")} data-testid="delete-account-reauthentication">
          <p className={slot("reauthenticationLead")}>{copy.confirmWithLead}</p>
          {providers.map((provider) => (
            <form key={provider.id} action={reauthentication.signInAction}>
              <input type="hidden" name="provider" value={provider.id} />
              <input type="hidden" name="next" value={reauthentication.next} />
              <Button type="submit" variant="secondary" fullWidth unstyled={unstyled}>
                {formatMessage(copy.confirmWith, { provider: provider.name })}
              </Button>
            </form>
          ))}
        </div>
      )}
      <form action={formAction} className={slot("form")}>
        {hasPasswordField ? (
          <PasswordField
            name="password"
            label={messages.delete.password}
            autoComplete="current-password"
            error={errorAt("password")}
            unstyled={unstyled}
            locale={locale}
          />
        ) : null}
        <Checkbox name="confirm" label={messages.delete.confirm} required error={errorAt("confirm")} unstyled={unstyled} />
        <FormError message={state.field === undefined || (state.field === "password" && !hasPasswordField) ? message : undefined} unstyled={unstyled} />
        <Button type="submit" variant="danger" fullWidth pending={isPending} unstyled={unstyled}>
          {isPending ? messages.delete.pending : messages.delete.submit}
        </Button>
      </form>
    </div>
  );
}
