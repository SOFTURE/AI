"use client";

import { formatMessage, type Locale } from "@softure-ai/core";
import { Button, Checkbox, type ClassNames, createSlotClassGetter, FormError, PasswordField, TextField } from "@softure-ai/ui";
import { type ReactNode, useActionState } from "react";
import { type AuthFormField, type AuthFormState, INITIAL_AUTH_FORM_STATE } from "../contract.js";
import { type AuthMessages, getAuthErrorMessage } from "../messages/index.js";

// The auth forms. Each submits straight to its server action through `useActionState`, so it
// works before (and without) JavaScript, and a server-side redirect after login is followed.
// Copy comes from the module's messages; styling only from @softure-ai/ui classes and tokens.

export type AuthFormAction = (previous: AuthFormState, formData: FormData) => Promise<AuthFormState>;

export type AuthFormSlot = "root" | "form" | "footer" | "link" | "notice";

interface AuthFormBaseProps {
  readonly action: AuthFormAction;
  readonly messages: AuthMessages;
  /** Locale of the built-in copy of the ui primitives. */
  readonly locale?: Locale;
  readonly classNames?: ClassNames<AuthFormSlot>;
  readonly unstyled?: boolean;
}

const DEFAULT_CLASSES: Readonly<Record<AuthFormSlot, string>> = {
  root: "sft:flex sft:flex-col sft:gap-3 sft:font-sans",
  form: "sft:flex sft:flex-col sft:gap-3",
  footer: "sft:m-0 sft:text-sm sft:text-muted",
  link: "sft:font-medium sft:text-accent",
  notice: "sft:m-0 sft:text-sm sft:text-success",
};

/** The error of one field, or of the form when no field owns it. */
function useErrors(state: AuthFormState, messages: AuthMessages) {
  const message = state.error === undefined ? undefined : getAuthErrorMessage(messages, state.error);
  return {
    at: (field: AuthFormField) => (state.field === field ? message : undefined),
    form: state.field === undefined ? message : undefined,
  };
}

function FormShell({
  formAction,
  isPending,
  submitLabel,
  pendingLabel,
  formError,
  footer,
  slot,
  unstyled,
  children,
}: {
  formAction: (formData: FormData) => void;
  isPending: boolean;
  submitLabel: string;
  pendingLabel: string;
  formError: string | undefined;
  footer?: ReactNode;
  slot: (part: AuthFormSlot) => string | undefined;
  unstyled: boolean | undefined;
  children: ReactNode;
}) {
  return (
    <div className={slot("root")}>
      <form action={formAction} className={slot("form")}>
        {children}
        <FormError message={formError} unstyled={unstyled} />
        <Button type="submit" variant="primary" fullWidth pending={isPending} unstyled={unstyled}>
          {isPending ? pendingLabel : submitLabel}
        </Button>
      </form>
      {footer}
    </div>
  );
}

export interface LoginFormProps extends AuthFormBaseProps {
  /** Where to go after login; checked again on the server. */
  readonly next?: string;
  /** Link to the register page; omitted when registration is not offered. */
  readonly registerHref?: string;
  /** Link to the password reset request page; omitted when reset is not offered. */
  readonly forgotPasswordHref?: string;
  /** A confirmation shown under the form, e.g. after a password reset. */
  readonly notice?: string;
}

export function LoginForm({ action, messages, locale, next, registerHref, forgotPasswordHref, notice, classNames, unstyled }: LoginFormProps) {
  const [state, formAction, isPending] = useActionState(action, INITIAL_AUTH_FORM_STATE);
  const errors = useErrors(state, messages);
  const slot = createSlotClassGetter({ defaults: DEFAULT_CLASSES, classNames, unstyled });
  const footer =
    registerHref === undefined && forgotPasswordHref === undefined && notice === undefined ? undefined : (
      <>
        {notice === undefined ? null : (
          <p role="status" className={slot("notice")}>
            {notice}
          </p>
        )}
        {forgotPasswordHref === undefined ? null : (
          <p className={slot("footer")}>
            <a href={forgotPasswordHref} className={slot("link")}>
              {messages.login.forgotPassword}
            </a>
          </p>
        )}
        {registerHref === undefined ? null : (
          <p className={slot("footer")}>
            {messages.login.noAccount}{" "}
            <a href={registerHref} className={slot("link")}>
              {messages.login.registerLink}
            </a>
          </p>
        )}
      </>
    );
  return (
    <FormShell
      formAction={formAction}
      isPending={isPending}
      submitLabel={messages.login.submit}
      pendingLabel={messages.login.pending}
      formError={errors.form}
      footer={footer}
      slot={slot}
      unstyled={unstyled}
    >
      {next === undefined ? null : <input type="hidden" name="next" value={next} />}
      <TextField
        name="email"
        type="email"
        label={messages.fields.email}
        autoComplete="email"
        required
        defaultValue={state.email ?? ""}
        error={errors.at("email")}
        unstyled={unstyled}
        locale={locale}
      />
      <PasswordField
        name="password"
        label={messages.fields.password}
        autoComplete="current-password"
        error={errors.at("password")}
        unstyled={unstyled}
        locale={locale}
      />
    </FormShell>
  );
}

export interface RegisterFormProps extends AuthFormBaseProps {
  readonly next?: string;
  readonly loginHref?: string;
  /** Show the consent checkbox (the module's `requireConsent`). */
  readonly requireConsent: boolean;
  /** The password policy's minimum, for the hint and the browser check. */
  readonly minPasswordLength: number;
  /** The consent statement; may contain links to the terms. Defaults to `messages.fields.consent`. */
  readonly consentLabel?: ReactNode;
}

export function RegisterForm({
  action,
  messages,
  locale,
  next,
  loginHref,
  requireConsent,
  minPasswordLength,
  consentLabel,
  classNames,
  unstyled,
}: RegisterFormProps) {
  const [state, formAction, isPending] = useActionState(action, INITIAL_AUTH_FORM_STATE);
  const errors = useErrors(state, messages);
  const slot = createSlotClassGetter({ defaults: DEFAULT_CLASSES, classNames, unstyled });
  const footer =
    loginHref === undefined ? undefined : (
      <p className={slot("footer")}>
        {messages.register.hasAccount}{" "}
        <a href={loginHref} className={slot("link")}>
          {messages.register.loginLink}
        </a>
      </p>
    );
  return (
    <FormShell
      formAction={formAction}
      isPending={isPending}
      submitLabel={messages.register.submit}
      pendingLabel={messages.register.pending}
      formError={errors.form}
      footer={footer}
      slot={slot}
      unstyled={unstyled}
    >
      {next === undefined ? null : <input type="hidden" name="next" value={next} />}
      <TextField
        name="email"
        type="email"
        label={messages.fields.email}
        autoComplete="email"
        required
        defaultValue={state.email ?? ""}
        error={errors.at("email")}
        unstyled={unstyled}
        locale={locale}
      />
      <PasswordField
        name="password"
        label={messages.fields.password}
        hint={formatMessage(messages.fields.newPasswordHint, { minLength: minPasswordLength })}
        autoComplete="new-password"
        minLength={minPasswordLength}
        error={errors.at("password")}
        unstyled={unstyled}
        locale={locale}
      />
      {requireConsent ? (
        <Checkbox name="consent" label={consentLabel ?? messages.fields.consent} required error={errors.at("consent")} unstyled={unstyled} />
      ) : null}
    </FormShell>
  );
}

export interface ChangePasswordFormProps extends AuthFormBaseProps {
  readonly minPasswordLength: number;
}

export function ChangePasswordForm({ action, messages, locale, minPasswordLength, classNames, unstyled }: ChangePasswordFormProps) {
  const [state, formAction, isPending] = useActionState(action, INITIAL_AUTH_FORM_STATE);
  const errors = useErrors(state, messages);
  const slot = createSlotClassGetter({ defaults: DEFAULT_CLASSES, classNames, unstyled });
  const notice =
    state.status === "ok" ? (
      <p role="status" className={slot("notice")}>
        {messages.changePassword.success}
      </p>
    ) : undefined;
  return (
    <FormShell
      formAction={formAction}
      isPending={isPending}
      submitLabel={messages.changePassword.submit}
      pendingLabel={messages.changePassword.pending}
      formError={errors.form}
      footer={notice}
      slot={slot}
      unstyled={unstyled}
    >
      <PasswordField
        name="currentPassword"
        label={messages.fields.currentPassword}
        autoComplete="current-password"
        error={errors.at("currentPassword")}
        unstyled={unstyled}
        locale={locale}
      />
      <PasswordField
        name="newPassword"
        label={messages.fields.newPassword}
        hint={formatMessage(messages.fields.newPasswordHint, { minLength: minPasswordLength })}
        autoComplete="new-password"
        minLength={minPasswordLength}
        error={errors.at("newPassword")}
        unstyled={unstyled}
        locale={locale}
      />
    </FormShell>
  );
}

export interface ForgotPasswordFormProps extends AuthFormBaseProps {
  /** How long a link works, for the confirmation. */
  readonly ttlMinutes: number;
  readonly loginHref?: string;
}

/** Asks for a reset link. Its confirmation is the same whether or not the email has an account. */
export function ForgotPasswordForm({ action, messages, locale, ttlMinutes, loginHref, classNames, unstyled }: ForgotPasswordFormProps) {
  const [state, formAction, isPending] = useActionState(action, INITIAL_AUTH_FORM_STATE);
  const errors = useErrors(state, messages);
  const slot = createSlotClassGetter({ defaults: DEFAULT_CLASSES, classNames, unstyled });
  const backToLogin =
    loginHref === undefined ? undefined : (
      <p className={slot("footer")}>
        <a href={loginHref} className={slot("link")}>
          {messages.forgotPassword.backToLogin}
        </a>
      </p>
    );
  if (state.status === "ok") {
    return (
      <div className={slot("root")}>
        <p role="status" className={slot("notice")}>
          {formatMessage(messages.forgotPassword.sent, { ttlMinutes })}
        </p>
        {backToLogin}
      </div>
    );
  }
  return (
    <FormShell
      formAction={formAction}
      isPending={isPending}
      submitLabel={messages.forgotPassword.submit}
      pendingLabel={messages.forgotPassword.pending}
      formError={errors.form}
      footer={backToLogin}
      slot={slot}
      unstyled={unstyled}
    >
      <TextField
        name="email"
        type="email"
        label={messages.fields.email}
        autoComplete="email"
        required
        defaultValue={state.email ?? ""}
        error={errors.at("email")}
        unstyled={unstyled}
        locale={locale}
      />
    </FormShell>
  );
}

export interface ResetPasswordFormProps extends AuthFormBaseProps {
  /** The token from the reset link; checked again on the server. */
  readonly token: string;
  readonly minPasswordLength: number;
}

/** Sets a new password from a reset link; its action goes to the login page on success. */
export function ResetPasswordForm({ action, messages, locale, token, minPasswordLength, classNames, unstyled }: ResetPasswordFormProps) {
  const [state, formAction, isPending] = useActionState(action, INITIAL_AUTH_FORM_STATE);
  const errors = useErrors(state, messages);
  const slot = createSlotClassGetter({ defaults: DEFAULT_CLASSES, classNames, unstyled });
  return (
    <FormShell
      formAction={formAction}
      isPending={isPending}
      submitLabel={messages.resetPassword.submit}
      pendingLabel={messages.resetPassword.pending}
      formError={errors.form}
      slot={slot}
      unstyled={unstyled}
    >
      <input type="hidden" name="token" value={token} />
      <PasswordField
        name="newPassword"
        label={messages.fields.newPassword}
        hint={formatMessage(messages.fields.newPasswordHint, { minLength: minPasswordLength })}
        autoComplete="new-password"
        minLength={minPasswordLength}
        error={errors.at("newPassword")}
        unstyled={unstyled}
        locale={locale}
      />
    </FormShell>
  );
}
