"use client";

import { formatMessage } from "@softure-ai/core";
import { Button, type ButtonVariant, type ClassNames, createSlotClassGetter, FormError } from "@softure-ai/ui";
import type { AuthMessages } from "../messages/index.js";

// The OpenID Connect buttons: one small form per provider, posting `provider` and `next` to the start action
// (`oidcSignInAction` of `@softure-ai/auth/next`), so it works without JavaScript. Copy comes from messages.

export type OidcSignInSlot = "root" | "form" | "submit" | "divider";

export interface OidcSignInProvider {
  readonly id: string;
  /** Shown in `messages.oidc.signInWith`, e.g. Google. */
  readonly name: string;
}

export interface OidcSignInProps {
  readonly action: (formData: FormData) => void | Promise<void>;
  readonly providers: readonly OidcSignInProvider[];
  readonly messages: AuthMessages;
  /** Where to go after the sign-in; checked again on the server. */
  readonly next?: string;
  /** A failed sign-in's message, e.g. from the login page's `?oidc_error=`. */
  readonly error?: string;
  /** Shows `messages.oidc.divider` under the buttons, before a password form. */
  readonly hasDivider?: boolean;
  readonly classNames?: ClassNames<OidcSignInSlot>;
  readonly unstyled?: boolean;
  /** The buttons' look; `secondary` by default. */
  readonly submitVariant?: ButtonVariant;
}

const DEFAULT_CLASSES: Readonly<Record<OidcSignInSlot, string>> = {
  root: "sft:flex sft:flex-col sft:gap-3 sft:font-sans",
  form: "sft:flex sft:flex-col",
  // The button styles itself; the slot only carries the app's class.
  submit: "",
  divider: "sft:m-0 sft:text-center sft:text-sm sft:text-muted",
};

export function OidcSignIn(props: OidcSignInProps) {
  const { action, providers, messages, next, error, hasDivider = false, classNames, unstyled, submitVariant = "secondary" } = props;
  const slot = createSlotClassGetter({ defaults: DEFAULT_CLASSES, classNames, unstyled });
  return (
    <div className={slot("root")}>
      <FormError message={error} unstyled={unstyled} />
      {providers.map((provider) => (
        <form key={provider.id} action={action} className={slot("form")}>
          <input type="hidden" name="provider" value={provider.id} />
          {next === undefined ? null : <input type="hidden" name="next" value={next} />}
          <Button type="submit" variant={submitVariant} fullWidth classNames={{ root: slot("submit") }} unstyled={unstyled}>
            {formatMessage(messages.oidc.signInWith, { provider: provider.name })}
          </Button>
        </form>
      ))}
      {hasDivider ? <p className={slot("divider")}>{messages.oidc.divider}</p> : null}
    </div>
  );
}
