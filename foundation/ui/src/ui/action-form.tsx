"use client";

import type { Err, ErrorCode, Ok } from "@softure-ai/core";
import { type ReactNode, useActionState, useEffect } from "react";
import { Button, type ButtonVariant } from "./button.js";
import { type ClassNames, createSlotClassGetter } from "./class-names.js";
import { type CopyProps, getCopy } from "./copy.js";
import { FormError } from "./feedback.js";
import { type FieldErrors, type FormReplay, FormReplayProvider, type SubmittedValues } from "./form-context.js";
import { ModalBody, ModalFooter, ModalForm } from "./modal.js";
import { announceToast } from "./toast.js";

// A form wired to a server action. Ported from FIRE_TRACKER src/components/action-form.tsx.
// - A rejected submit replays what was typed (React resets an uncontrolled form after its action)
//   and shows the form error and each field's error.
// - A successful submit announces `successMessage` as a toast and calls `onSuccess`.
// - With `onCancel` it lays itself out as a modal's body and footer; otherwise it is a page form.
// Errors come back as codes (docs/02 §6); `getErrorMessage` turns them into the app's copy.

/** What the server action returns: success, or an error code with optional per-field codes. */
export type ActionResult = Ok<undefined> | (Err<ErrorCode> & { readonly fieldErrors?: Readonly<Record<string, ErrorCode>> });

export type ActionFormSlot = "root" | "actions";

export interface ActionFormProps extends CopyProps<"actionForm"> {
  readonly action: (formData: FormData) => Promise<ActionResult>;
  /** The app's copy for an error code (the form error and every field error). */
  readonly getErrorMessage: (code: ErrorCode) => string;
  readonly submitLabel: string;
  /** The submit label while saving; the package's "Saving…" by default. */
  readonly pendingLabel?: string;
  /** Toast after a successful submit; an empty string shows none. */
  readonly successMessage?: string;
  readonly children: ReactNode;
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
  const copy = getCopy("actionForm", { locale, messages });
  const [state, formAction, isPending] = useActionState<FormState, FormData>(async (previous, formData) => {
    const submitCount = previous.replay.submitCount + 1;
    const values = getSubmittedValues(formData);
    let result: ActionResult;
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
    const fieldErrors: FieldErrors = Object.fromEntries(
      Object.entries(result.fieldErrors ?? {}).map(([name, code]) => [name, getErrorMessage(code)]),
    );
    return {
      status: "error",
      message: getErrorMessage(result.error),
      replay: { values, fieldErrors, submitCount, hasReplay: true },
    };
  }, INITIAL_STATE);

  useEffect(() => {
    if (onPendingChange === undefined) return;
    onPendingChange(isPending);
    return () => onPendingChange(false);
  }, [isPending, onPendingChange]);

  const slot = createSlotClassGetter({ defaults: DEFAULT_CLASSES, classNames, unstyled });
  const label = getSubmitLabel({ isPending, submitLabel, pendingLabel: pendingLabel ?? copy.pending });
  const error = state.status === "error" ? state.message : undefined;

  return (
    <FormReplayProvider replay={state.replay}>
      {onCancel === undefined ? (
        <form action={formAction} className={slot("root")}>
          {children}
          <FormError message={error} unstyled={unstyled} />
          <div className={slot("actions")}>
            <Button type="submit" variant={submitVariant} pending={isPending} fullWidth={fullWidthSubmit} unstyled={unstyled}>
              {label}
            </Button>
          </div>
        </form>
      ) : (
        <ModalForm action={formAction} unstyled={unstyled}>
          <ModalBody unstyled={unstyled}>{children}</ModalBody>
          <ModalFooter onCancel={onCancel} isPending={isPending} error={error} unstyled={unstyled} locale={locale} messages={modalMessages}>
            <Button type="submit" variant={submitVariant} pending={isPending} unstyled={unstyled}>
              {label}
            </Button>
          </ModalFooter>
        </ModalForm>
      )}
    </FormReplayProvider>
  );
}
