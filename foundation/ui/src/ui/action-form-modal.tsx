"use client";

import { type ReactNode, useCallback, useState } from "react";
import { ActionForm, type ActionFormProps } from "./action-form.js";
import { IconButton, type IconButtonSlot } from "./button.js";
import type { ClassNames } from "./class-names.js";
import { PlusIcon } from "./icons.js";
import { Modal, type ModalHeadingLevel, type ModalSlot, type ModalWidth } from "./modal.js";

// An `ActionForm` in a `Modal`: the form's body and footer are the dialog's, a running save makes the
// dialog not dismissible, and a successful save closes it. `ModalTrigger` adds the "+" button that opens
// it; the dialog returns focus to that button when it closes.

/** `Omit` applied to each member of a union, so the `ActionForm` props keep their two shapes. */
type DistributiveOmit<Type, Key extends PropertyKey> = Type extends unknown ? Omit<Type, Key> : never;

/** The form's props, without what the dialog wires itself. */
export type ActionFormModalFormProps = DistributiveOmit<ActionFormProps, "onCancel" | "onPendingChange" | "fullWidthSubmit">;

export interface ActionFormModalOptions {
  readonly title: string;
  readonly subtitle?: string;
  /** `form` by default; `panel` for a sheet from the right. */
  readonly width?: ModalWidth;
  readonly headingLevel?: ModalHeadingLevel;
  /** Cancel, Escape, the backdrop, the close button, and a successful save. */
  readonly onClose: () => void;
  readonly modalClassNames?: ClassNames<ModalSlot>;
}

export type ActionFormModalProps = ActionFormModalFormProps & ActionFormModalOptions;

/** A dialog holding one form that submits to a server action; render it while it is open. */
export function ActionFormModal(props: ActionFormModalProps) {
  const { title, subtitle, width, headingLevel, onClose, modalClassNames, onSuccess, ...formProps } = props;
  const [isPending, setIsPending] = useState(false);
  const handleSuccess = useCallback(() => {
    onSuccess?.();
    onClose();
  }, [onSuccess, onClose]);
  return (
    <Modal
      title={title}
      subtitle={subtitle}
      width={width}
      headingLevel={headingLevel}
      onClose={onClose}
      isDismissible={!isPending}
      locale={formProps.locale}
      messages={formProps.modalMessages}
      classNames={modalClassNames}
      unstyled={formProps.unstyled}
    >
      <ActionForm {...formProps} onCancel={onClose} onPendingChange={setIsPending} onSuccess={handleSuccess} />
    </Modal>
  );
}

export interface ModalTriggerOptions {
  /** The button's accessible name ("Add debt"). */
  readonly label: string;
  /** The button's icon; `PlusIcon` by default. */
  readonly icon?: ReactNode;
  /** A frame around the button; on by default. */
  readonly bordered?: boolean;
  readonly disabled?: boolean;
  readonly triggerClassNames?: ClassNames<IconButtonSlot>;
  /** Called after the dialog closed, however it closed. */
  readonly onClose?: () => void;
}

export type ModalTriggerProps = DistributiveOmit<ActionFormModalProps, "onClose"> & ModalTriggerOptions;

/** An icon button ("+") that opens an `ActionFormModal`, which closes after a successful save. */
export function ModalTrigger(props: ModalTriggerProps) {
  const { label, icon, bordered = true, disabled, triggerClassNames, onClose, ...modalProps } = props;
  const [isOpen, setIsOpen] = useState(false);
  const close = useCallback(() => {
    setIsOpen(false);
    onClose?.();
  }, [onClose]);
  return (
    <>
      <IconButton
        label={label}
        bordered={bordered}
        disabled={disabled}
        aria-haspopup="dialog"
        onClick={() => setIsOpen(true)}
        classNames={triggerClassNames}
        unstyled={modalProps.unstyled}
      >
        {icon ?? <PlusIcon />}
      </IconButton>
      {isOpen ? <ActionFormModal {...modalProps} onClose={close} /> : null}
    </>
  );
}
