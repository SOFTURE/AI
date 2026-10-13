"use client";

import { type FormEvent, type ReactNode, useCallback, useState } from "react";
import { Button, type ButtonSize, type ButtonVariant, IconButton } from "./button.js";
import { type ClassNames, createSlotClassGetter } from "./class-names.js";
import { type CopyProps, getCopy } from "./copy.js";
import { useUiCopyProps, useUiLocale } from "./locale.js";
import { Modal, ModalBody, ModalFooter, type ModalMotion, type ModalSlot } from "./modal.js";
import { announceToast } from "./toast.js";

// A destructive action (delete, revoke, sign out everywhere) behind a confirmation dialog that states
// the stakes. The dialog waits for the user: there is no timer that cancels the confirmation. While the
// action runs the dialog cannot be dismissed; a success closes it and announces the server's message as
// a toast, a failure keeps it open with the error above the buttons.

/** What the action returns: success with an optional message for the toast, or a user-facing error. */
export type ConfirmActionResult = { readonly ok: true; readonly message?: string } | { readonly ok: false; readonly error: string };

/**
 * `trigger` is the button that opens the dialog, `confirm` the dialog's confirm button, `cancel` is added to
 * the footer's Cancel button. The dialog's own parts take `modalClassNames`.
 */
export type ConfirmActionButtonSlot = "trigger" | "description" | "confirm" | "cancel";

/**
 * What runs on confirm: a callback (`action`), or a form action (`formAction`, a server action) that receives the
 * dialog's form data, with `fields` as its hidden inputs (the record's `id`).
 */
export type ConfirmActionRun =
  | { readonly action: () => Promise<ConfirmActionResult>; readonly formAction?: undefined; readonly fields?: undefined }
  | {
      readonly action?: undefined;
      readonly formAction: (formData: FormData) => Promise<ConfirmActionResult>;
      /** Hidden inputs posted with the form, by name. */
      readonly fields?: Readonly<Record<string, string>>;
    };

export type ConfirmActionButtonProps = ConfirmActionButtonOwnProps & ConfirmActionRun;

interface ConfirmActionButtonOwnProps extends CopyProps<"confirmAction"> {
  /** The trigger's text, or its accessible name with `isIconOnly`. */
  readonly label: string;
  /** A decorative icon before the label, or the whole trigger with `isIconOnly` (`TrashIcon`). */
  readonly icon?: ReactNode;
  /** Renders the trigger as an `IconButton` (tone `danger`) named by `label`. */
  readonly isIconOnly?: boolean;
  /** The trigger's variant; `danger` by default. */
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
  readonly disabled?: boolean;
  /** The dialog's title, a question naming the action ("Delete this account?"). */
  readonly title: string;
  /** The stakes: what is lost and whether it can be undone. */
  readonly description: ReactNode;
  readonly confirmLabel: string;
  /** The confirm button's label while the action runs. */
  readonly pendingLabel?: string;
  /** The toast when the action returns no message of its own; an empty string shows none. */
  readonly successMessage?: string;
  readonly onSuccess?: () => void;
  /** Copy overrides for the dialog's Close and Cancel. */
  readonly modalMessages?: CopyProps<"modal">["messages"];
  /** The dialog's slots (`overlay`, `panel`, `close`…), for the app's dialog motion and close button. */
  readonly modalClassNames?: ClassNames<ModalSlot>;
  /** The dialog's `motion`; `enter` by default. */
  readonly modalMotion?: ModalMotion;
  readonly classNames?: ClassNames<ConfirmActionButtonSlot>;
  readonly unstyled?: boolean;
}

/** A button that runs a destructive action after the user confirms it in a dialog. */
export function ConfirmActionButton({
  label,
  icon,
  isIconOnly = false,
  variant = "danger",
  size,
  disabled,
  title,
  description,
  confirmLabel,
  pendingLabel,
  action,
  formAction,
  fields,
  successMessage = "",
  onSuccess,
  modalMessages,
  modalClassNames,
  modalMotion,
  classNames,
  unstyled,
  locale,
  messages,
}: ConfirmActionButtonProps) {
  const resolvedLocale = useUiLocale(locale);
  const copy = getCopy("confirmAction", useUiCopyProps("confirmAction", { locale: resolvedLocale, messages }));
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const closeDialog = useCallback(() => {
    setIsOpen(false);
    setError(undefined);
  }, []);

  async function confirm(run: () => Promise<ConfirmActionResult>) {
    setIsPending(true);
    setError(undefined);
    let result: ConfirmActionResult;
    try {
      result = await run();
    } catch (rejection: unknown) {
      // A rejected action (network failure, a stale server action) becomes an error in the dialog.
      console.error("ConfirmActionButton: the action rejected", rejection);
      setIsPending(false);
      setError(copy.failed);
      return;
    }
    setIsPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    closeDialog();
    const message = result.message ?? successMessage;
    if (message !== "") announceToast(message);
    onSuccess?.();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (formAction === undefined || isPending) return;
    const formData = new FormData(event.currentTarget);
    void confirm(() => formAction(formData));
  }

  const slot = createSlotClassGetter<ConfirmActionButtonSlot>({
    defaults: { trigger: "", description: "sft:m-0 sft:text-sm sft:text-foreground", confirm: "", cancel: "" },
    classNames,
    unstyled,
  });

  const content = (
    <>
      <ModalBody unstyled={unstyled}>
        <div className={slot("description")}>{description}</div>
      </ModalBody>
      <ModalFooter
        onCancel={closeDialog}
        isPending={isPending}
        error={error}
        locale={resolvedLocale}
        messages={modalMessages}
        classNames={{ cancel: classNames?.cancel }}
        unstyled={unstyled}
      >
        <Button
          variant="danger"
          type={formAction === undefined ? "button" : "submit"}
          pending={isPending}
          pendingLabel={pendingLabel}
          onClick={action === undefined ? undefined : () => void confirm(action)}
          className={slot("confirm")}
          unstyled={unstyled}
        >
          {confirmLabel}
        </Button>
      </ModalFooter>
    </>
  );

  return (
    <>
      {isIconOnly ? (
        <IconButton
          label={label}
          tone="danger"
          disabled={disabled}
          aria-haspopup="dialog"
          onClick={() => setIsOpen(true)}
          classNames={{ root: slot("trigger") }}
          unstyled={unstyled}
        >
          {icon}
        </IconButton>
      ) : (
        <Button
          variant={variant}
          size={size}
          iconLeft={icon}
          disabled={disabled}
          aria-haspopup="dialog"
          onClick={() => setIsOpen(true)}
          className={slot("trigger")}
          unstyled={unstyled}
        >
          {label}
        </Button>
      )}
      {isOpen ? (
        <Modal
          title={title}
          width="confirmation"
          onClose={closeDialog}
          isDismissible={!isPending}
          motion={modalMotion}
          locale={resolvedLocale}
          messages={modalMessages}
          classNames={modalClassNames}
          unstyled={unstyled}
        >
          {formAction === undefined ? (
            content
          ) : (
            // The form spans the body and the footer, so the confirm button submits it; it takes no box of its own.
            <form onSubmit={handleSubmit} className={unstyled === true ? undefined : "sft:contents"}>
              {Object.entries(fields ?? {}).map(([fieldName, fieldValue]) => (
                <input key={fieldName} type="hidden" name={fieldName} value={fieldValue} />
              ))}
              {content}
            </form>
          )}
        </Modal>
      ) : null}
    </>
  );
}
