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
  TextField,
} from "@softure-ai/ui";
import { type ReactNode, useActionState, useEffect, useRef } from "react";
import { INITIAL_WAITLIST_FORM_STATE, type WaitlistFormState, type WaitlistFormSuccessState } from "../contract.js";
import { EMAIL_FIELD, getScopeFieldName, PLACEMENT_FIELD } from "../fields.js";
import { getWaitlistErrorMessage, type WaitlistMessages } from "../messages/index.js";

// The waitlist form: an email field, one checkbox per consent scope and the submit button. It
// submits straight to its server action through `useActionState`, so it works before (and without)
// JavaScript; after a sign-up it shows the confirmation (or, with double opt-in, where to confirm)
// instead of the form, with the person's unsubscribe link when the action returned one; `success` replaces that
// view with the app's own and `onSuccess` follows it. Copy comes from the module's messages and the scope labels
// the server prepared; styling only from @softure-ai/ui, with the app's look and ids passed through to its primitives.

export type WaitlistFormAction = (previous: WaitlistFormState, formData: FormData) => Promise<WaitlistFormState>;

export type WaitlistFormSlot = "root" | "form" | "scopes" | "notice" | "unsubscribe" | "submit";

/** One consent checkbox, prepared on the server. */
export interface WaitlistFormScope {
  readonly id: string;
  /** The statement in the app's copy; may contain links (e.g. to the privacy policy). */
  readonly label: ReactNode;
  /** The form cannot be sent without it. */
  readonly required: boolean;
  /** A line under the statement (e.g. "You can unsubscribe any time."), tied to the box with `aria-describedby`. */
  readonly description?: ReactNode;
  /** The box's id, stable across renders (e.g. for a link or a test); unique on the page. Generated without it. */
  readonly inputId?: string;
}

/** The email field's own props: a stable id (e.g. for a sticky bar elsewhere that focuses it) and the app's placeholder. */
export interface WaitlistEmailProps {
  readonly id?: string;
  readonly placeholder?: string;
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
  /**
   * Shown in the `root` slot in place of the default success view (the notice and the unsubscribe link) once the
   * sign-up counts or waits for its confirmation link. A function gets that state, e.g. to tell `ok` from
   * `confirmation_sent` or to show `unsubscribeUrl`.
   */
  readonly success?: ReactNode | ((state: WaitlistFormSuccessState) => ReactNode);
  /** Called once per successful answer, after the success view is on the page (e.g. to move focus to it). */
  readonly onSuccess?: (state: WaitlistFormSuccessState) => void;
  /** The email field's id and placeholder. */
  readonly emailProps?: WaitlistEmailProps;
  /** Classes for the email field (label, input, ...), to match the app's other forms. */
  readonly fieldClassNames?: ClassNames<InputFieldSlot>;
  /** Where the email field shows a hint: under the label (default) or behind a "?" tooltip. */
  readonly fieldHintAs?: HintPlacement;
  /** The tooltip hint's look, so it matches the app's standalone hints. */
  readonly fieldHintProps?: HintAppearance;
  /** Classes for every consent box (box, label, description, ...). */
  readonly scopeClassNames?: ClassNames<CheckboxSlot>;
  /** The submit button's look; `primary` by default. Its class goes in `classNames.submit`. */
  readonly submitVariant?: ButtonVariant;
  /** Whether the submit button fills the form's width; `true` by default. */
  readonly submitFullWidth?: boolean;
}

const DEFAULT_CLASSES: Readonly<Record<WaitlistFormSlot, string>> = {
  root: "sft:flex sft:flex-col sft:gap-3 sft:font-sans",
  form: "sft:flex sft:flex-col sft:gap-3",
  scopes: "sft:flex sft:flex-col sft:gap-3",
  notice: "sft:m-0 sft:text-sm sft:text-success",
  unsubscribe: "sft:m-0 sft:text-sm sft:text-muted sft:break-words",
  submit: "",
};

const SECONDS_PER_MINUTE = 60;

/** The error's copy; a rate limit refusal that carries its wait says how many minutes are left. */
function getErrorMessage(messages: WaitlistMessages, state: WaitlistFormState): string | undefined {
  if (state.error === undefined) return undefined;
  if (state.error === "security.rate_limited" && state.retryAfterSeconds !== undefined) {
    return formatMessage(messages.form.retryAfter, { minutes: getRetryMinutes(state.retryAfterSeconds) });
  }
  return getWaitlistErrorMessage(messages, state.error);
}

/** Whole minutes, rounded up and at least 1, so a wait under a minute never reads as "0 min". */
function getRetryMinutes(seconds: number): number {
  return Math.max(1, Math.ceil(seconds / SECONDS_PER_MINUTE));
}

function isSuccessState(state: WaitlistFormState): state is WaitlistFormSuccessState {
  return state.status === "ok" || state.status === "confirmation_sent";
}

export function WaitlistForm({
  action,
  scopes,
  placement,
  messages,
  locale,
  classNames,
  unstyled,
  success,
  onSuccess,
  emailProps,
  fieldClassNames,
  fieldHintAs,
  fieldHintProps,
  scopeClassNames,
  submitVariant = "primary",
  submitFullWidth = true,
}: WaitlistFormProps) {
  const [state, formAction, isPending] = useActionState(action, INITIAL_WAITLIST_FORM_STATE);
  const slot = createSlotClassGetter({ defaults: DEFAULT_CLASSES, classNames, unstyled });
  // Each answer is a new state object, so remembering the last one notified keeps re-renders and
  // Strict Mode's second effect run from calling `onSuccess` twice.
  const notifiedState = useRef<WaitlistFormState | null>(null);
  useEffect(() => {
    if (onSuccess === undefined || !isSuccessState(state) || notifiedState.current === state) return;
    notifiedState.current = state;
    onSuccess(state);
  }, [state, onSuccess]);

  if (isSuccessState(state)) {
    if (success !== undefined) {
      return <div className={slot("root")}>{typeof success === "function" ? success(state) : success}</div>;
    }
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

  const message = getErrorMessage(messages, state);
  const checked = new Set(state.scopes ?? []);
  return (
    <div className={slot("root")}>
      <form action={formAction} className={slot("form")}>
        <input type="hidden" name={PLACEMENT_FIELD} value={placement} />
        <TextField
          id={emailProps?.id}
          name={EMAIL_FIELD}
          type="email"
          label={messages.form.email}
          autoComplete="email"
          placeholder={emailProps?.placeholder}
          required
          defaultValue={state.email ?? ""}
          error={state.field === "email" ? message : undefined}
          locale={locale}
          classNames={fieldClassNames}
          hintAs={fieldHintAs}
          hintProps={fieldHintProps}
          unstyled={unstyled}
        />
        <div className={slot("scopes")}>
          {scopes.map((scope) => (
            <Checkbox
              // Remounted after each answer, so the checked state follows the last submit.
              key={`${scope.id}:${String(checked.has(scope.id))}`}
              id={scope.inputId}
              name={getScopeFieldName(scope.id)}
              label={scope.label}
              description={scope.description}
              required={scope.required}
              defaultChecked={checked.has(scope.id)}
              classNames={scopeClassNames}
              unstyled={unstyled}
            />
          ))}
        </div>
        <FormError message={state.field === "email" ? undefined : message} unstyled={unstyled} />
        <Button
          type="submit"
          variant={submitVariant}
          fullWidth={submitFullWidth}
          pending={isPending}
          pendingLabel={messages.form.pending}
          classNames={{ root: slot("submit") }}
          unstyled={unstyled}
        >
          {messages.form.submit}
        </Button>
      </form>
    </div>
  );
}
