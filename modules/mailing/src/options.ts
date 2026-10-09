// The options an app passes to `mailing({ ... })` in softure.config.ts, parsed at startup.
import { z } from "zod";
import { isMailbox, isMailKind, isSingleAddress } from "./address.js";
import type { CampaignRecipientFilter, CampaignRecipientSource, LegacyUnsubscribe, MailProvider, OnUnsubscribedHook } from "./contract.js";

export const DEFAULT_TIMEOUT_MS = 10_000;
/** How long a delivery claim may stay open before another sender may take it over (and send again, same key). */
export const DEFAULT_STALE_CLAIM_MS = 15 * 60_000;
/**
 * How old a claim may get before it is "uncertain" and never taken over by itself: its send may have gone out, and
 * the provider may have forgotten the idempotency key (Resend keeps one for 24 hours), so a retake could mail twice.
 */
export const DEFAULT_UNCERTAIN_CLAIM_MS = 23 * 60 * 60_000;
/**
 * Claims a delivery gets before `mailing.unavailable` becomes its final outcome. A short outage across a few runs is
 * ridden out, while a provider that keeps failing on one mail does not keep it open forever.
 */
export const DEFAULT_MAX_ATTEMPTS = 5;

/** Query names the signed link and the page use; a legacy link cannot claim them. */
const RESERVED_LINK_PARAMS: ReadonlySet<string> = new Set(["r", "status"]);
const LINK_PARAM = /^[A-Za-z][A-Za-z0-9_-]{0,31}$/;

const MAX_LINK_PARAMS = 8;
const linkParamNames = z.array(z.string().regex(LINK_PARAM, "must be a query name: a letter, then letters, digits, _ or -, at most 32 characters"));

/** Both forms of `params`, normalised to required and optional names, with the limits on all names together. */
const legacyParamsSchema = z
  .union([linkParamNames.min(1), z.strictObject({ required: linkParamNames.min(1), optional: linkParamNames.default([]) })])
  .transform((params) => (Array.isArray(params) ? { required: params, optional: [] } : params))
  .refine(({ required, optional }) => required.length + optional.length <= MAX_LINK_PARAMS, `must name at most ${String(MAX_LINK_PARAMS)} parameters`)
  .refine(({ required, optional }) => new Set([...required, ...optional]).size === required.length + optional.length, "must not repeat a name")
  .refine(
    ({ required, optional }) => [...required, ...optional].every((param) => !RESERVED_LINK_PARAMS.has(param)),
    "must not use r or status: the signed link and the page own them",
  );

const legacyUnsubscribeSchema = z.strictObject({
  params: legacyParamsSchema,
  verify: z.custom<LegacyUnsubscribe["verify"]>((value) => typeof value === "function", "must be a function"),
});

const HOUR_MS = 60 * 60_000;

const mailKind = z.string().refine(isMailKind, "must be a kebab-case mail kind such as newsletter");

/** Alias to kind; an alias never names a kind another alias points at, so one lookup resolves it. */
const kindAliasesSchema = z
  .record(mailKind, mailKind)
  .refine((aliases) => Object.keys(aliases).every((alias) => !Object.values(aliases).includes(alias)), "must not use a kind as an alias: aliases resolve in one step");

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
  /**
   * The only address `softure-mail test` sends to, e.g. the operator's inbox. Without it the command refuses to send,
   * so a test never reaches a customer.
   */
  testAddress: z.string().trim().refine(isSingleAddress, "must be one address, e.g. ops@example.com").optional(),
  /**
   * Short names for mail kinds in campaign files and `softure-mail test --kind`, e.g. `{ news: "newsletter" }`. The
   * campaign is stored and sent under the kind the alias names.
   */
  kindAliases: kindAliasesSchema.optional(),
  /** The adapter that delivers mail: `resend()`, or `fakeMailProvider()` from `/testing`. */
  provider: z.custom<MailProvider>(isMailProvider, "must be a mail provider such as resend()"),
  /** How long one send may take before it reads as `mailing.unavailable`. */
  timeoutMs: z.number().int().min(1_000).max(60_000).default(DEFAULT_TIMEOUT_MS),
  /**
   * Reacts to an unsubscribe in its transaction, e.g. `withdrawWaitlistConsents` of
   * `@softure-ai/waitlist/server`, which records the withdrawal in privacy's consent ledger.
   */
  onUnsubscribed: z.custom<OnUnsubscribedHook>((value) => typeof value === "function", "must be a function").optional(),
  /** Verifies unsubscribe links the app sent before it adopted the module (see `LegacyUnsubscribe`). */
  legacyUnsubscribe: legacyUnsubscribeSchema.optional(),
  /**
   * What the one-click route answers for a link that does not verify: 400 (the default), or 200 so the answer never
   * tells whether a token is live. A failure still answers 500, so the mail client retries; the page is unaffected.
   */
  oneClickInvalidLinkStatus: z.union([z.literal(200), z.literal(400)]).default(400),
  /** Decides per recipient whether a campaign goes to them, e.g. by consent scope (see `CampaignRecipientFilter`). */
  filterCampaignRecipient: z.custom<CampaignRecipientFilter>((value) => typeof value === "function", "must be a function").optional(),
  /**
   * Lists a campaign's recipients from the app's data; `softure-mail campaign` uses it when no `--recipients` file
   * is given (see `CampaignRecipientSource`).
   */
  listCampaignRecipients: z.custom<CampaignRecipientSource>((value) => typeof value === "function", "must be a function").optional(),
  /**
   * Claims a delivery gets before `mailing.unavailable` closes it as rejected, 1 to 100; `null` never closes it, for
   * apps that retry on their own schedule. Default 5.
   */
  maxAttempts: z.number().int().min(1).max(100).nullable().default(DEFAULT_MAX_ATTEMPTS),
  /** How long a delivery claim may stay open before another sender takes it over. 1 minute to 23 hours. */
  staleClaimMs: z.number().int().min(60_000).max(23 * HOUR_MS).default(DEFAULT_STALE_CLAIM_MS),
  /**
   * How old a claim may get before it is never taken over by itself (`uncertain`); keep it under the provider's
   * idempotency window. More than `staleClaimMs`, at most 30 days.
   */
  uncertainClaimMs: z.number().int().min(60_000).max(30 * 24 * HOUR_MS).default(DEFAULT_UNCERTAIN_CLAIM_MS),
}).refine((options) => options.uncertainClaimMs > options.staleClaimMs, { message: "must be more than staleClaimMs", path: ["uncertainClaimMs"] });

export type MailingOptionsInput = z.input<typeof mailingOptionsSchema>;
export type MailingOptions = z.output<typeof mailingOptionsSchema>;
