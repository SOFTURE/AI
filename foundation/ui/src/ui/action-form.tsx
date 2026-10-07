"use client";

import type { Err, ErrorCode } from "@softure-ai/core";
import { type ReactNode, useActionState, useEffect } from "react";
import { Button, type ButtonVariant } from "./button.js";
import { type ClassNames, createSlotClassGetter } from "./class-names.js";
import { type CopyProps, getCopy } from "./copy.js";
import { FormError } from "./feedback.js";
import { type FieldErrors, type FormReplay, FormReplayProvider, type SubmittedValues } from "./form-context.js";
import { ModalBody, ModalFooter, ModalForm } from "./modal.js";
import { announceToast } from "./toast.js";
import { useUiLocale } from "./locale.js";

// A form wired to a server action.
// - A rejected submit replays what was typed (React resets an uncontrolled form after its action)
//   and shows the form error and each field's error.
// - A successful submit announces `successMessage` as a toast and calls `onSuccess`.
// - With `onCancel` it lays itself out as a modal's body and footer; otherwise it is a page form.
// Errors come back as codes (docs/02 §6) that `getErrorMessage` turns into the app's copy, or, for an app whose
// actions already return user-facing text, as messages shown as they are (`MessageActionResult`, no mapper).

/**
 * What the server action returns: success, or an error code with optional per-field codes. Success
 * may carry a value (`ok(x)`, any `Ok<T>`) or none (`{ ok: true }`, `ok()`); the form does not read it.
 */
export type ActionResult =
  | ActionSuccess
  | (Err<ErrorCode> & { readonly fieldErrors?: Readonly<Record<string, ErrorCode>> });

/**
 * What a server action returns when its errors are ready user-facing messages (already in the user's language),
 * not codes. `ActionForm` shows them as they are when no `getErrorMessage` is given.
 */
export type MessageActionResult =
  | ActionSuccess
  | { readonly ok: false; readonly error: string; readonly fieldErrors?: Readonly<Record<string, string>> };

/** A successful action: `Ok<T>` of any `T`, or a bare `{ ok: true }`. */
export interface ActionSuccess {
  readonly ok: true;
  readonly value?: unknown;
}

export type ActionFormSlot = "root" | "actions";

/** Errors as codes: the action returns `ActionResult` and `getErrorMessage` gives the copy for each code. */
export interface CodeErrorsProps {
  readonly action: (formData: FormData) => Promise<ActionResult>;
  /** The app's copy for an error code (the form error and every field error). */
  readonly getErrorMessage: (code: ErrorCode) => string;
}

/** Errors as messages: the action returns `MessageActionResult` and its strings are shown as they are. */
export interface MessageErrorsProps {
  readonly action: (formData: FormData) => Promise<MessageActionResult>;
  readonly getErrorMessage?: undefined;
}

export type ActionFormProps = (CodeErrorsProps | MessageErrorsProps) & ActionFormOptions;

export interface ActionFormOptions extends CopyProps<"actionForm"> {
  readonly submitLabel: string;
  /** The submit label while saving; the package's "Saving…" by default. */
  readonly pendingLabel?: string;
  /** Toast after a successful submit; an empty string shows none. */
  readonly successMessage?: string;
  readonly children: ReactNode;
  /**
   * The submit button's variant; `primary` by default, the one main action of the form. An app whose
   * own forms defaulted to another variant passes it here (or sets it on every form it migrates).
   */
  readonly submitVariant?: ButtonVariant;
  readonly fullWidthSubmit?: boolean;
  readonly onSuccess?: () => void;
  /** Turns the form into a modal's body and footer, with Cancel calling this. */
  readonly onCancel?: () => void;
  /** Copy overrides for the modal footer (its Cancel label) when `onCancel` is set. */
  readonly modalMessages?: CopyProps<"modal">["messages"];
  /** Reports a running save, for example to make the surrounding modal not dismissible. */
  readonly onPendingChange?: (isPending: boolean) => void;
  readonly classNames?: ClassNames<ActionFormSlot>;
  readonly unstyled?: boolean;
}

interface FormState {
  readonly status: "idle" | "ok" | "error";
  readonly message?: string;
  readonly replay: FormReplay;
}

const INITIAL_STATE: FormState = { status: "idle", replay: { values: {}, fieldErrors: {}, submitCount: 0, hasReplay: false } };

/** The label of the submit button: the pending label only while a submit runs. */
export function getSubmitLabel({
  isPending,
  submitLabel,
  pendingLabel,
}: {
  isPending: boolean;
  submitLabel: string;
  pendingLabel: string;
}): string {
  return isPending ? pendingLabel : submitLabel;
}

/** The text values of a submit, by name (files are not replayed). */
function getSubmittedValues(formData: FormData): SubmittedValues {
  return Object.fromEntries(
    [...formData.entries()].flatMap(([key, value]) => (typeof value === "string" ? [[key, value] as const] : [])),
  );
}

const DEFAULT_CLASSES: Readonly<Record<ActionFormSlot, string>> = {
  root: "sft:flex sft:flex-col sft:gap-3 sft:font-sans",
  actions: "sft:flex sft:items-center sft:gap-2",
};

/** The form error and field errors of a failed result, as text. */
function getErrorTexts(
  result: Exclude<ActionResult | MessageActionResult, ActionSuccess>,
  getErrorMessage: ((code: ErrorCode) => string) | undefined,
): { message: string; fieldErrors: FieldErrors } {
  // Without a mapper the props type the action as `MessageActionResult`: its errors are text already.
  const toText = getErrorMessage === undefined ? (error: string) => error : (error: string) => getErrorMessage(error as ErrorCode);
  return {
    message: toText(result.error),
    fieldErrors: Object.fromEntries(Object.entries(result.fieldErrors ?? {}).map(([name, error]) => [name, toText(error)])),
  };
}

/** A form that submits to a server action and handles its result. */
export function ActionForm({
  action,
  getErrorMessage,
  submitLabel,
  pendingLabel,
  successMessage = "",
  children,
  submitVariant = "primary",
  fullWidthSubmit = false,
  onSuccess,
  onCancel,
  onPendingChange,
  classNames,
  unstyled,
  locale,
  messages,
  modalMessages,
}: ActionFormProps) {
  const copy = getCopy("actionForm", { locale: useUiLocale(locale), messages });
  const [state, formAction, isPending] = useActionState<FormState, FormData>(async (previous, formData) => {
    const submitCount = previous.replay.submitCount + 1;
    const values = getSubmittedValues(formData);
    let result: ActionResult | MessageActionResult;
    try {
      result = await action(formData);
    } catch (error: unknown) {
      // A rejected action (network failure, a stale server action) would reach the error boundary
      // and drop what the user typed; it becomes a form error instead, and the cause is reported.
      console.error("ActionForm: the action rejected", error);
      return { status: "error", message: copy.failed, replay: { values, fieldErrors: {}, submitCount, hasReplay: true } };
    }
    if (result.ok) {
      onSuccess?.();
      if (successMessage !== "") announceToast(successMessage);
      return { status: "ok", replay: { values: {}, fieldErrors: {}, submitCount, hasReplay: false } };
    }
    const { message, fieldErrors } = getErrorTexts(result, getErrorMessage);
    return { status: "error", message, replay: { values, fieldErrors, submitCount, hasReplay: true } };
  }, INITIAL_STATE);

  useEffect(() => {
    if (onPendingChange === undefined) return;
    onPendingChange(isPending);
    return () => onPendingChange(false);
  }, [isPending, onPendingChange]);

  const slot = createSlotClassGetter({ defaults: DEFAULT_CLASSES, classNames, unstyled });
  const error = state.status === "error" ? state.message : undefined;

  return (
    <FormReplayProvider replay={state.replay}>
      {onCancel === undefined ? (
        <form action={formAction} className={slot("root")}>
          {children}
          <FormError message={error} unstyled={unstyled} />
          <div className={slot("actions")}>
            <Button
              type="submit"
              variant={submitVariant}
              pending={isPending}
              pendingLabel={pendingLabel ?? copy.pending}
              fullWidth={fullWidthSubmit}
              unstyled={unstyled}
            >
              {submitLabel}
            </Button>
          </div>
        </form>
      ) : (
        <ModalForm action={formAction} unstyled={unstyled}>
          <ModalBody unstyled={unstyled}>{children}</ModalBody>
          <ModalFooter onCancel={onCancel} isPending={isPending} error={error} unstyled={unstyled} locale={locale} messages={modalMessages}>
            <Button type="submit" variant={submitVariant} pending={isPending} pendingLabel={pendingLabel ?? copy.pending} unstyled={unstyled}>
              {submitLabel}
            </Button>
          </ModalFooter>
        </ModalForm>
      )}
    </FormReplayProvider>
  );
}
