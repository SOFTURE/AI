"use client";

import type { Locale } from "@softure-ai/core";
import { ActionForm, TextField } from "@softure-ai/ui";
import { getErrorMessage, getMessages } from "../../../messages/index.ts";
import { sendTestMail } from "./actions.ts";

export function TestMailForm({ locale }: { readonly locale: Locale }) {
  const messages = getMessages(locale);
  return (
    <ActionForm
      action={sendTestMail}
      getErrorMessage={(code) => getErrorMessage(messages, code)}
      submitLabel={messages.mail.submit}
      successMessage={messages.mail.sent}
      locale={locale}
    >
      <TextField name="subject" label={messages.mail.subjectLabel} defaultValue={messages.mail.defaultSubject} required />
    </ActionForm>
  );
}
