"use client";

import type { Locale } from "@softure-ai/core";
import { ActionForm, TextField } from "@softure-ai/ui";
import { getErrorMessage, getMessages } from "../../../messages/index.ts";
import { signAsMember } from "./actions.ts";

export function MemberEntryForm({ locale }: { readonly locale: Locale }) {
  const messages = getMessages(locale);
  return (
    <ActionForm
      action={signAsMember}
      getErrorMessage={(code) => getErrorMessage(messages, code)}
      submitLabel={messages.billing.submit}
      successMessage={messages.billing.saved}
      locale={locale}
    >
      <TextField name="message" label={messages.billing.messageLabel} required />
    </ActionForm>
  );
}
