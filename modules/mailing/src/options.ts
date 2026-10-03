// The options an app passes to `mailing({ ... })` in softure.config.ts, parsed at startup.
import { z } from "zod";
import { isMailbox, isSingleAddress } from "./address.js";
import type { MailProvider, OnUnsubscribedHook } from "./contract.js";

export const DEFAULT_TIMEOUT_MS = 10_000;

function isMailProvider(value: unknown): value is MailProvider {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as { name?: unknown; send?: unknown };
  return typeof candidate.name === "string" && candidate.name !== "" && typeof candidate.send === "function";
}

export const mailingOptionsSchema = z.strictObject({
  /**
   * The sender of every mail: `hello@example.com` or `Plan <hello@example.com>`. It must be on a
   * domain the provider signs (DKIM), or DMARC rejects the mail.
   */
  from: z.string().trim().refine(isMailbox, "must be an address or Name <address>, e.g. Plan <hello@example.com>"),
  /** Where replies go; may sit on another domain than `from` (DMARC does not check it). */
  replyTo: z.string().trim().refine(isSingleAddress, "must be one address, e.g. support@example.com").optional(),
  /** The adapter that delivers mail: `resend()`, or `fakeMailProvider()` from `/testing`. */
  provider: z.custom<MailProvider>(isMailProvider, "must be a mail provider such as resend()"),
  /** How long one send may take before it reads as `mailing.unavailable`. */
  timeoutMs: z.number().int().min(1_000).max(60_000).default(DEFAULT_TIMEOUT_MS),
  /**
   * Reacts to an unsubscribe in its transaction, e.g. `withdrawWaitlistConsents` of
   * `@softure-ai/waitlist/server`, which records the withdrawal in privacy's consent ledger.
   */
  onUnsubscribed: z.custom<OnUnsubscribedHook>((value) => typeof value === "function", "must be a function").optional(),
});

export type MailingOptionsInput = z.input<typeof mailingOptionsSchema>;
export type MailingOptions = z.output<typeof mailingOptionsSchema>;
