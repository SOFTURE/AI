// Result types, error codes and the provider contract of the mailing module. No user-facing copy
// here: the UI translates codes through `messages` (docs/02-module-standard.md §6).
import type { Result } from "@softure-ai/core";

export type MailingErrorCode =
  /** The mail or its options were refused before anything left the process. Fix the input; do not retry. */
  | "mailing.invalid_input"
  /** The provider refused the mail. Retrying the same request will not help. */
  | "mailing.rejected"
  /** The provider could not be reached or did not answer in time. Retry later, with the same idempotency key. */
  | "mailing.unavailable"
  /** A list mail to a recipient who unsubscribed. Nothing was sent; do not retry. */
  | "mailing.suppressed";

/** Why an unsubscribe link was refused: missing, malformed, or not signed by a current secret. */
export type UnsubscribeErrorCode = "mailing.invalid_link";

/** The kind of every mail that is not list mail: sent whatever the recipient unsubscribed from. */
export const TRANSACTIONAL_KIND = "transactional";

/** How an opt-out arrived: a mail client's one-click POST, the page's button, or an operator. */
export type SuppressionSource = "one-click" | "page" | "operator";

/** One mail to one recipient. A mail to a list is a loop over recipients, never a list in `to`. */
export interface OutgoingMail {
  /** Exactly one address: `ada@example.com`. */
  readonly to: string;
  /** One line, 1 to 998 characters. */
  readonly subject: string;
  /** The plain-text body. Required: every mail carries a text part. */
  readonly text: string;
  /** The HTML body, already rendered to a string. */
  readonly html?: string;
  /**
   * Extra headers, for example `List-Unsubscribe`. They cannot replace the envelope, the sender or
   * the body's encoding: reserved names are refused (`RESERVED_HEADERS`).
   */
  readonly headers?: Readonly<Record<string, string>>;
  /**
   * `transactional` (the default) for mail the recipient needs whatever they unsubscribed from:
   * password resets, receipts, account notices. Any other kebab-case name (e.g. `newsletter`) is
   * list mail: it gets a signed unsubscribe link in a footer and the RFC 8058 headers, and is
   * refused with `mailing.suppressed` for a recipient who unsubscribed. Unsubscribing covers every
   * list kind.
   */
  readonly kind?: string;
}

export interface SendMailOptions {
  /**
   * Makes a retry safe: the provider treats requests with the same key as one mail (Resend keeps a
   * key for 24 hours). 1 to 256 visible ASCII characters, e.g. `campaign-42:recipient-7`.
   */
  readonly idempotencyKey?: string;
}

/** A mail the provider accepted. */
export interface SentMail {
  /** The provider's message id. */
  readonly id: string;
  /** The provider's name, e.g. `resend`. */
  readonly provider: string;
}

export type SendMailResult = Result<SentMail, MailingErrorCode>;

/** What a provider receives: a validated mail with the sender and reply-to from the configuration. */
export interface ProviderMessage {
  readonly from: string;
  readonly to: string;
  readonly replyTo: string | null;
  readonly subject: string;
  readonly text: string;
  readonly html: string | null;
  readonly headers: Readonly<Record<string, string>>;
  readonly idempotencyKey: string | null;
}

/** What a provider answers. `httpStatus` is logged; the mail never is. */
export type ProviderOutcome =
  | { readonly status: "sent"; readonly id: string }
  | { readonly status: "rejected"; readonly httpStatus?: number }
  | { readonly status: "unavailable"; readonly httpStatus?: number };

/**
 * A mail service adapter. `send` should resolve with an outcome for every failure it knows; a
 * throw reads as `unavailable`. It receives a signal that aborts at the configured timeout.
 */
export interface MailProvider {
  /** A short lowercase name for logs and `SentMail.provider`. */
  readonly name: string;
  send(message: ProviderMessage, context: { readonly signal: AbortSignal }): Promise<ProviderOutcome>;
}
