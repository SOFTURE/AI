"use client";

import type { Locale } from "@softure-ai/core";
import { ActionForm, Button, Modal, TextField } from "@softure-ai/ui";
import { useState } from "react";
import { getErrorMessage, getMessages } from "../messages/index.ts";
import { addGuestbookEntry } from "./actions.ts";

export function AddEntry({ locale }: { readonly locale: Locale }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const messages = getMessages(locale);
  const copy = messages.guestbook;

  function close() {
    setIsOpen(false);
  }

  return (
    <>
      <Button variant="primary" onClick={() => setIsOpen(true)}>
        {copy.add}
      </Button>
      {isOpen ? (
        <Modal title={copy.modalTitle} onClose={close} isDismissible={!isSaving} locale={locale}>
          <ActionForm
            action={addGuestbookEntry}
            getErrorMessage={(code) => getErrorMessage(messages, code)}
            submitLabel={copy.submit}
            successMessage={copy.saved}
            onSuccess={close}
            onCancel={close}
            onPendingChange={setIsSaving}
            locale={locale}
          >
            <TextField name="message" label={copy.messageLabel} required />
          </ActionForm>
        </Modal>
      ) : null}
    </>
  );
}
