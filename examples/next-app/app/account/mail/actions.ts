"use server";

// Sends a test mail to the signed-in user's own address through @softure-ai/mailing. The session
// is checked before the form is read; the address comes from the session, never from the form, so
// the page cannot send mail to anyone else.
import { getCurrentUser } from "@softure-ai/auth/next";
import { err, ok } from "@softure-ai/core";
import { sendMail } from "@softure-ai/mailing/next";
import type { ActionResult } from "@softure-ai/ui";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getMessages } from "../../../messages/index.ts";
import config from "../../../softure.config.ts";

const testMailInput = z.object({
  subject: z.string().trim().min(1).max(200),
});

export async function sendTestMail(formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (user === null) return err("auth.unauthenticated");

  const input = testMailInput.safeParse({ subject: formData.get("subject") });
  if (!input.success) {
    return { ...err("mailing.invalid_input"), fieldErrors: { subject: "mailing.invalid_input" } };
  }
  const messages = getMessages(config.locale);
  const result = await sendMail(
    { to: user.email, subject: input.data.subject, text: messages.mail.body, html: `<p>${escapeHtml(messages.mail.body)}</p>` },
    // One key per submit: a retry of this request (not a second click) is the same mail.
    { idempotencyKey: `example-test-mail:${user.id}:${randomUUID()}` },
  );
  return result.ok ? ok() : result;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
