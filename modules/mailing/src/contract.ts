// Result types, error codes and the provider contract of the mailing module. No user-facing copy
// here: the UI translates codes through `messages` (docs/02-module-standard.md §6).
import type { Err, ModuleContext, Ok } from "@softure-ai/core";
import type { Queryable } from "@softure-ai/db";

export type MailingErrorCode =
  /** The mail or its options were refused before anything left the process. Fix the input; do not retry. */
  | "mailing.invalid_input"
  /** The provider refused the mail. Retrying the same request will not help. */
  | "mailing.rejected"
  /** The provider could not be reached or did not answer in time. Retry later, with the same idempotency key. */
  | "mailing.unavailable"
  /** A list mail to a recipient who unsubscribed. Nothing was sent; do not retry. */
  | "mailing.suppressed"
  /**
   * The provider refuses the sender, not the mail: a wrong or revoked API key, a suspended or restricted account
   * (HTTP 401/403). Every other mail would fail the same way: stop sending, fix the account, then retry.
   */
  | "mailing.provider_refused"
  /** The account's sending quota is spent (HTTP 429 that is not a rate limit). Stop sending; retry when it renews. */
  | "mailing.quota_exceeded";

/** The codes that are about the sending account, not the mail: a run of sends stops at the first one. */
export const HALTING_ERROR_CODES: ReadonlySet<MailingErrorCode> = new Set(["mailing.provider_refused", "mailing.quota_exceeded"]);

/** Why an unsubscribe link was refused: missing, malformed, or not signed by a current secret. */
export type UnsubscribeErrorCode = "mailing.invalid_link";

/** The kind of every mail that is not list mail: sent whatever the recipient unsubscribed from. */
export const TRANSACTIONAL_KIND = "transactional";

/** How an opt-out arrived: a mail client's one-click POST, the page's button, or an operator. */
export type SuppressionSource = "one-click" | "page" | "operator";

/**
 * The link an unsubscribe came through, once verified: the module's signed link, or a legacy link with the values
 * the app's `verify` accepted (only the names the link carried), so a hook can find the row that link named.
 */
export type VerifiedUnsubscribeLink = { readonly scheme: "signed" } | { readonly scheme: "legacy"; readonly values: Readonly<Record<string, string>> };

/** What `onUnsubscribed` receives: who opted out (never the address), how, and through which link. */
export interface UnsubscribeEvent {
  /** The recipient key of the link: privacy's email key of the same address (`getEmailKey`). */
  readonly recipientKey: string;
  readonly source: Exclude<SuppressionSource, "operator">;
  readonly link: VerifiedUnsubscribeLink;
}

/**
 * Called on every verified unsubscribe, in the suppression's transaction (`ctx.db` is that
 * transaction): a throw rolls the opt-out back and the unsubscribe fails, so the consent ledger
 * and the suppression list never disagree. Set in `mailing({ onUnsubscribed })`.
 */
export type OnUnsubscribedHook = (event: UnsubscribeEvent, ctx: ModuleContext<Queryable>) => Promise<void>;

/** What `filterCampaignRecipient` receives for each recipient of a campaign. */
export interface CampaignRecipient {
  readonly address: string;
  /** The recipient key of the address (`getRecipientKey`). */
  readonly recipientKey: string;
  readonly campaign: { readonly id: string; readonly kind: string };
}

/**
 * Decides whether a campaign goes to a recipient, e.g. by the consent scope the app stored for the address. A
 * recipient it refuses is skipped before the ledger is touched, so a later re-run sends to them once they qualify.
 * A throw stops the campaign, like a database failure. Set in `mailing({ filterCampaignRecipient })`.
 */
export type CampaignRecipientFilter = (recipient: CampaignRecipient, ctx: ModuleContext<Queryable>) => Promise<boolean>;

/**
 * Lists the addresses a campaign goes to, from the app's own data (e.g. the people who opted in to its kind), so a
 * campaign can run where the database is without a recipients file. Duplicates are fine; `filterCampaignRecipient`
 * and the suppression list still apply. A throw stops the campaign. Set in `mailing({ listCampaignRecipients })`.
 */
export type CampaignRecipientSource = (
  campaign: { readonly id: string; readonly kind: string },
  ctx: ModuleContext<Queryable>,
) => Iterable<string> | AsyncIterable<string> | Promise<Iterable<string>>;

/**
 * The query names of a legacy link. An array lists names the link must all carry. The object form adds names it
 * may carry: a link is legacy when it has every `required` name, and the `optional` ones it has go to `verify` too.
 * At most 8 names in all, none repeated, never `r` or `status`.
 */
export type LegacyUnsubscribeParams = readonly string[] | { readonly required: readonly string[]; readonly optional?: readonly string[] };

/**
 * Unsubscribe links an app sent before it adopted the module, in its own scheme. `params` are the query names of
 * such a link; `verify` receives the values the link carried (every required name, the optional names that are
 * present and non-empty, each at most 512 characters) and returns the recipient's address when the link is genuine,
 * else `null`. It must check the link's signature itself: whatever address it returns is unsubscribed. A throw
 * reads as a failure (the person may try again), not as a bad link.
 */
export interface LegacyUnsubscribe {
  readonly params: LegacyUnsubscribeParams;
  readonly verify: (values: Readonly<Record<string, string>>, ctx: ModuleContext<Queryable>) => Promise<string | null>;
}

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

/** A failed send: the code, and the provider's HTTP status when it answered with one. */
export type SendMailFailure = Err<MailingErrorCode> & { readonly httpStatus?: number };

export type SendMailResult = Ok<SentMail> | SendMailFailure;

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

/**
 * What a provider answers. `httpStatus` is logged and returned with the failure; the mail never is. `refused` is the
 * provider refusing the sender (key, account), `quota_exceeded` a spent sending quota; `rejected` is about this mail.
 */
export type ProviderOutcome =
  | { readonly status: "sent"; readonly id: string }
  | { readonly status: ProviderFailureStatus; readonly httpStatus?: number };

export type ProviderFailureStatus = "rejected" | "unavailable" | "refused" | "quota_exceeded";

/**
 * A mail service adapter. `send` should resolve with an outcome for every failure it knows; a
 * throw reads as `unavailable`. It receives a signal that aborts at the configured timeout.
 */
export interface MailProvider {
  /** A short lowercase name for logs and `SentMail.provider`. */
  readonly name: string;
  send(message: ProviderMessage, context: { readonly signal: AbortSignal }): Promise<ProviderOutcome>;
}
