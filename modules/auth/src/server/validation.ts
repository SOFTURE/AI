// Input rules for emails and new passwords. Expected failures are codes the form shows next to the field.
import { err, ok, type Err, type Ok } from "@softure-ai/core";
import { z } from "zod";
import { MAX_PASSWORD_LENGTH } from "./password.js";

const MAX_EMAIL_LENGTH = 254;
const emailSchema = z.email();

/** Trims and lowercases an email, so two spellings are one account. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** The normalized email, or `auth.email_invalid`. */
export function parseEmail(email: string): Ok<string> | Err<"auth.email_invalid"> {
  const normalized = normalizeEmail(email);
  if (normalized.length > MAX_EMAIL_LENGTH || !emailSchema.safeParse(normalized).success) {
    return err("auth.email_invalid");
  }
  return ok(normalized);
}

/** Whether a new password fits the policy. Length counts characters, not UTF-16 units. */
export function checkNewPassword(
  password: string,
  minLength: number,
): Ok<undefined> | Err<"auth.password_too_short" | "auth.password_too_long"> {
  const length = [...password.normalize("NFC")].length;
  if (length < minLength) return err("auth.password_too_short");
  if (length > MAX_PASSWORD_LENGTH) return err("auth.password_too_long");
  return ok();
}
