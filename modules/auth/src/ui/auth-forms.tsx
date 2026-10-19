"use client";

import { formatMessage, type Locale } from "@softure-ai/core";
import {
  Button,
  type ButtonVariant,
  Checkbox,
  type CheckboxSlot,
  type ClassNames,
  createSlotClassGetter,
  FormError,
  type HintAppearance,
  type HintPlacement,
  type InputFieldSlot,
  PasswordField,
  TextField,
} from "@softure-ai/ui";
import { type InvalidEvent, type ReactNode, useActionState, useState } from "react";
import { type AuthFormField, type AuthFormState, INITIAL_AUTH_FORM_STATE } from "../contract.js";
import { type AuthMessages, getAuthErrorMessage } from "../messages/index.js";

// The auth forms. Each submits straight to its server action through `useActionState`, so it
// works before (and without) JavaScript, and a server-side redirect after login is followed.
// Copy comes from the module's messages; styling only from @softure-ai/ui classes and tokens.

export type AuthFormAction = (previous: AuthFormState, formData: FormData) => Promise<AuthFormState>;

export type AuthFormSlot = "root" | "form" | "footer" | "link" | "notice" | "submit";

interface AuthFormBaseProps {
  readonly action: AuthFormAction;
  readonly messages: AuthMessages;
  /** Locale of the built-in copy of the ui primitives. */
  readonly locale?: Locale;
  readonly classNames?: ClassNames<AuthFormSlot>;
  readonly unstyled?: boolean;
  /** The submit button's look; `primary` by default. Its class goes in `classNames.submit`. */
  readonly submitVariant?: ButtonVariant;
  /** Classes for every text and password field of the form (label, hint, input, ...), to match the app's other forms. */
  readonly fieldClassNames?: ClassNames<InputFieldSlot>;
  /** Where the fields show their hints: under the label (default) or behind a "?" tooltip. */
  readonly fieldHintAs?: HintPlacement;
  /** The tooltip hint's look for every field, so it matches the app's standalone hints. */
  readonly fieldHintProps?: HintAppearance;
}

/** The field props every form passes to each of its text and password fields. */
function getFieldLook({ fieldClassNames, fieldHintAs, fieldHintProps, unstyled, locale }: AuthFormBaseProps) {
  return { classNames: fieldClassNames, hintAs: fieldHintAs, hintProps: fieldHintProps, unstyled, locale };
}

const DEFAULT_CLASSES: Readonly<Record<AuthFormSlot, string>> = {
  root: "sft:flex sft:flex-col sft:gap-3 sft:font-sans",
  form: "sft:flex sft:flex-col sft:gap-3",
  footer: "sft:m-0 sft:text-sm sft:text-muted",
  link: "sft:font-medium sft:text-accent",
  notice: "sft:m-0 sft:text-sm sft:text-success",
  // The button styles itself; the slot only carries the app's class.
  submit: "",
};

/**
 * The error of one field, or of the form when no field owns it or the form does not render that field
 * (e.g. `consent` with the box left out), so a server error is never dropped.
 */
function useErrors(state: AuthFormState, messages: AuthMessages, renderedFields: readonly AuthFormField[]) {
  const message = state.error === undefined ? undefined : getAuthErrorMessage(messages, state.error);
  const isFieldRendered = state.field !== undefined && renderedFields.includes(state.field);
  return {
    at: (field: AuthFormField) => (state.field === field ? message : undefined),
    form: isFieldRendered ? undefined : message,
  };
}

/** The consent box's own props: its id (e.g. for the app's tests) and its look. */
export interface ConsentProps {
  readonly id?: string;
  readonly classNames?: ClassNames<CheckboxSlot>;
}

/** The first control of `form` that fails its constraints, in document order. */
function getFirstInvalidControl(form: HTMLFormElement): Element | undefined {
  return Array.from(form.elements).find(
    (element) =>
      (element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement) &&
      !element.validity.valid,
  );
}

/**
 * A required consent box. An unticked box shows `requiredMessage` under it instead of the browser's bubble (as ui's
 * `CheckboxField` in statement mode does) and takes focus when it is the form's first invalid control; the server's
 * error shows there otherwise.
 */
function ConsentCheckbox({
  label,
  requiredMessage,
  error,
  consentProps,
  unstyled,
}: {
  label: ReactNode;
  requiredMessage: string;
  error: string | undefined;
  consentProps: ConsentProps | undefined;
  unstyled: boolean | undefined;
}) {
  const [invalidMessage, setInvalidMessage] = useState<string | undefined>(undefined);
  function handleInvalid(event: InvalidEvent<HTMLInputElement>) {
    event.preventDefault();
    setInvalidMessage(requiredMessage);
    const box = event.currentTarget;
    const firstInvalid = box.form === null ? box : getFirstInvalidControl(box.form);
    if (firstInvalid === box) box.focus();
  }
  return (
    <Checkbox
      id={consentProps?.id}
      classNames={consentProps?.classNames}
      name="consent"
      label={label}
      required
      error={invalidMessage ?? error}
      onInvalid={handleInvalid}
      onChange={(event) => {
        if (event.currentTarget.checked) setInvalidMessage(undefined);
      }}
      unstyled={unstyled}
    />
  );
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
  submitVariant = "primary",
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
  submitVariant: ButtonVariant | undefined;
  children: ReactNode;
}) {
  return (
    <div className={slot("root")}>
      <form action={formAction} className={slot("form")}>
        {children}
        <FormError message={formError} unstyled={unstyled} />
        <Button type="submit" variant={submitVariant} fullWidth pending={isPending} classNames={{ root: slot("submit") }} unstyled={unstyled}>
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

export function LoginForm(props: LoginFormProps) {
  const { action, messages, next, registerHref, forgotPasswordHref, notice, classNames, unstyled, submitVariant } = props;
  const [state, formAction, isPending] = useActionState(action, INITIAL_AUTH_FORM_STATE);
  const errors = useErrors(state, messages, ["email", "password"]);
  const field = getFieldLook(props);
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
      submitVariant={submitVariant}
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
        {...field}
      />
      <PasswordField
        name="password"
        label={messages.fields.password}
        autoComplete="current-password"
        error={errors.at("password")}
        {...field}
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
  /** The consent box's id and look (`classNames` for its `CheckboxSlot`s). */
  readonly consentProps?: ConsentProps;
  /**
   * The app's own inputs, before the consent checkbox. Their values reach `onRegistered` as
   * `event.fields` when their names are declared in `auth({ registrationFields })`.
   */
  readonly extraFields?: ReactNode;
}

export function RegisterForm(props: RegisterFormProps) {
  const { action, messages, next, loginHref, requireConsent, minPasswordLength, consentLabel, consentProps, extraFields, classNames, unstyled, submitVariant } =
    props;
  const [state, formAction, isPending] = useActionState(action, INITIAL_AUTH_FORM_STATE);
  const errors = useErrors(state, messages, requireConsent ? ["email", "password", "consent"] : ["email", "password"]);
  const field = getFieldLook(props);
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
      submitVariant={submitVariant}
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
        {...field}
      />
      <PasswordField
        name="password"
        label={messages.fields.password}
        hint={formatMessage(messages.fields.newPasswordHint, { minLength: minPasswordLength })}
        autoComplete="new-password"
        minLength={minPasswordLength}
        error={errors.at("password")}
        {...field}
      />
      {extraFields}
      {requireConsent ? (
        <ConsentCheckbox
          label={consentLabel ?? messages.fields.consent}
          requiredMessage={messages.errors.auth.consent_required}
          error={errors.at("consent")}
          consentProps={consentProps}
          unstyled={unstyled}
        />
      ) : null}
    </FormShell>
  );
}

export interface ChangePasswordFormProps extends AuthFormBaseProps {
  readonly minPasswordLength: number;
}

export function ChangePasswordForm(props: ChangePasswordFormProps) {
  const { action, messages, minPasswordLength, classNames, unstyled, submitVariant } = props;
  const [state, formAction, isPending] = useActionState(action, INITIAL_AUTH_FORM_STATE);
  const errors = useErrors(state, messages, ["currentPassword", "newPassword"]);
  const field = getFieldLook(props);
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
      submitVariant={submitVariant}
    >
      <PasswordField
        name="currentPassword"
        label={messages.fields.currentPassword}
        autoComplete="current-password"
        error={errors.at("currentPassword")}
        {...field}
      />
      <PasswordField
        name="newPassword"
        label={messages.fields.newPassword}
        hint={formatMessage(messages.fields.newPasswordHint, { minLength: minPasswordLength })}
        autoComplete="new-password"
        minLength={minPasswordLength}
        error={errors.at("newPassword")}
        {...field}
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
export function ForgotPasswordForm(props: ForgotPasswordFormProps) {
  const { action, messages, ttlMinutes, loginHref, classNames, unstyled, submitVariant } = props;
  const [state, formAction, isPending] = useActionState(action, INITIAL_AUTH_FORM_STATE);
  const errors = useErrors(state, messages, ["email"]);
  const field = getFieldLook(props);
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
      submitVariant={submitVariant}
    >
      <TextField
        name="email"
        type="email"
        label={messages.fields.email}
        autoComplete="email"
        required
        defaultValue={state.email ?? ""}
        error={errors.at("email")}
        {...field}
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
export function ResetPasswordForm(props: ResetPasswordFormProps) {
  const { action, messages, token, minPasswordLength, classNames, unstyled, submitVariant } = props;
  const [state, formAction, isPending] = useActionState(action, INITIAL_AUTH_FORM_STATE);
  const errors = useErrors(state, messages, ["newPassword"]);
  const field = getFieldLook(props);
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
      submitVariant={submitVariant}
    >
      <input type="hidden" name="token" value={token} />
      <PasswordField
        name="newPassword"
        label={messages.fields.newPassword}
        hint={formatMessage(messages.fields.newPasswordHint, { minLength: minPasswordLength })}
        autoComplete="new-password"
        minLength={minPasswordLength}
        error={errors.at("newPassword")}
        {...field}
      />
    </FormShell>
  );
}
