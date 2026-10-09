"use client";

import { type ReactNode, useCallback, useState } from "react";
import { Button, type ButtonSize, type ButtonVariant, IconButton } from "./button.js";
import { type ClassNames, createSlotClassGetter } from "./class-names.js";
import { type CopyProps, getCopy } from "./copy.js";
import { useUiLocale } from "./locale.js";
import { Modal, ModalBody, ModalFooter } from "./modal.js";
import { announceToast } from "./toast.js";

// A destructive action (delete, revoke, sign out everywhere) behind a confirmation dialog that states
// the stakes. The dialog waits for the user: there is no timer that cancels the confirmation. While the
// action runs the dialog cannot be dismissed; a success closes it and announces the server's message as
// a toast, a failure keeps it open with the error above the buttons.

/** What the action returns: success with an optional message for the toast, or a user-facing error. */
export type ConfirmActionResult = { readonly ok: true; readonly message?: string } | { readonly ok: false; readonly error: string };

/** `trigger` is the button that opens the dialog, `confirm` the dialog's confirm button. */
export type ConfirmActionButtonSlot = "trigger" | "description" | "confirm";

export interface ConfirmActionButtonProps extends CopyProps<"confirmAction"> {
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
  readonly action: () => Promise<ConfirmActionResult>;
  /** The toast when the action returns no message of its own; an empty string shows none. */
  readonly successMessage?: string;
  readonly onSuccess?: () => void;
  /** Copy overrides for the dialog's Close and Cancel. */
  readonly modalMessages?: CopyProps<"modal">["messages"];
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
  successMessage = "",
  onSuccess,
  modalMessages,
  classNames,
  unstyled,
  locale,
  messages,
}: ConfirmActionButtonProps) {
  const resolvedLocale = useUiLocale(locale);
  const copy = getCopy("confirmAction", { locale: resolvedLocale, messages });
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const closeDialog = useCallback(() => {
    setIsOpen(false);
    setError(undefined);
  }, []);

  async function confirm() {
    setIsPending(true);
    setError(undefined);
    let result: ConfirmActionResult;
    try {
      result = await action();
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

  const slot = createSlotClassGetter<ConfirmActionButtonSlot>({
    defaults: { trigger: "", description: "sft:m-0 sft:text-sm sft:text-foreground", confirm: "" },
    classNames,
    unstyled,
  });

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
          locale={resolvedLocale}
          messages={modalMessages}
          unstyled={unstyled}
        >
          <ModalBody unstyled={unstyled}>
            <div className={slot("description")}>{description}</div>
          </ModalBody>
          <ModalFooter
            onCancel={closeDialog}
            isPending={isPending}
            error={error}
            locale={resolvedLocale}
            messages={modalMessages}
            unstyled={unstyled}
          >
            <Button
              variant="danger"
              pending={isPending}
              pendingLabel={pendingLabel}
              onClick={() => void confirm()}
              className={slot("confirm")}
              unstyled={unstyled}
            >
              {confirmLabel}
            </Button>
          </ModalFooter>
        </Modal>
      ) : null}
    </>
  );
}
