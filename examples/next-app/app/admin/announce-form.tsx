"use client";

import type { Locale } from "@softure-ai/core";
import { ActionForm, TextField } from "@softure-ai/ui";
import { getErrorMessage, getMessages } from "../../messages/index.ts";
import { postAnnouncement } from "./actions.ts";

export function AnnounceForm({ locale }: { readonly locale: Locale }) {
  const messages = getMessages(locale);
  return (
    <ActionForm
      action={postAnnouncement}
      getErrorMessage={(code) => getErrorMessage(messages, code)}
      submitLabel={messages.admin.submit}
      successMessage={messages.admin.saved}
      locale={locale}
    >
      <TextField name="message" label={messages.admin.messageLabel} required />
    </ActionForm>
  );
}
