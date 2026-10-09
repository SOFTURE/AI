// Sends one mail through the configured provider, with three rules: it never throws for a failed
// send (every failure is a result), nothing of the mail (address, subject, body, key) reaches a log
// or the result, and `headers` cannot replace the envelope or the sender (a mail's own reply-to is
// the `replyTo` field, checked like `to`). List mail (any kind but `transactional`) also gets a signed unsubscribe
// link in a footer and the RFC 8058 headers, and is refused for a recipient who unsubscribed.
import { err, ok, type Err, type Ok, type SoftureConfig } from "@softure-ai/core";
import type { Queryable } from "@softure-ai/db";
import {
  TRANSACTIONAL_KIND,
  type MailingErrorCode,
  type MailProvider,
  type OutgoingMail,
  type ProviderFailureStatus,
  type ProviderMessage,
  type ProviderOutcome,
  type SendMailOptions,
  type SendMailResult,
} from "../contract.js";
import type { MailingMessages } from "../messages/index.js";
import { addHtmlFooter, addTextFooter, getListUnsubscribeHeaders } from "./list-mail.js";
import { getMailingModule, getMailingOptions } from "./options.js";
import { isSuppressed } from "./suppressions.js";
import { buildUnsubscribeLinks, MIN_UNSUBSCRIBE_SECRET_LENGTH, readUnsubscribeSecrets, UNSUBSCRIBE_SECRET_ENV, type Env } from "./unsubscribe-link.js";
import { validateMail, type ValidMail } from "./validate-mail.js";

/**
 * What `sendMail` needs: the app's configuration and, for list mail, the database handle (the
 * suppression check reads it). Transactional mail needs no `db`.
 */
export interface MailContext {
  readonly config: SoftureConfig;
  readonly db?: Queryable;
}

/**
 * Sends `mail` and resolves with the provider's message id or a `mailing.*` code:
 * `invalid_input` (fix the input), `rejected` (do not retry), `unavailable` (retry later with the
 * same `idempotencyKey`), `suppressed` (a list mail to someone who unsubscribed; do not retry),
 * `provider_refused` / `quota_exceeded` (the account cannot send: stop, fix or wait, then retry). A
 * failure the provider answered with an HTTP status carries it as `httpStatus`.
 * Throws only when the module is not enabled, or for list mail without `context.db`.
 */
export async function sendMail(context: MailContext, mail: OutgoingMail, options: SendMailOptions = {}): Promise<SendMailResult> {
  const { provider, timeoutMs } = getMailingOptions(context.config);

  const validation = validateMail(mail, options);
  if (!validation.ok) {
    logFailure(provider, "mailing.invalid_input", { fields: validation.fields });
    return err("mailing.invalid_input");
  }
  const valid = validation.value;
  const secret = readUnsubscribeSecrets().current;
  if (valid.kind !== TRANSACTIONAL_KIND) {
    const refusal = await checkListMail(context, valid, secret);
    if (refusal !== null) {
      logFailure(provider, refusal.error, { cause: refusal.cause });
      return err(refusal.error);
    }
  }

  const outcome = await callProvider(provider, composeMessage(context.config, valid, secret), timeoutMs);
  if (outcome.status === "sent") {
    return ok({ id: outcome.id, provider: provider.name });
  }
  const code = FAILURE_CODES[outcome.status];
  logFailure(provider, code, { status: outcome.httpStatus });
  return outcome.httpStatus === undefined ? err(code) : { ...err(code), httpStatus: outcome.httpStatus };
}

/** Why `previewMail` cannot render a mail: invalid input (with the fields), or list mail without the secret. */
export type MailPreviewFailure =
  | (Err<"mailing.invalid_input"> & { readonly fields: readonly string[] })
  | (Err<"mailing.unavailable"> & { readonly cause: "no_unsubscribe_secret" });

export type MailPreviewResult = Ok<ProviderMessage> | MailPreviewFailure;

export interface PreviewMailOptions extends SendMailOptions {
  /** Where the unsubscribe secret is read. Default: `process.env`. */
  readonly env?: Env;
}

/**
 * Exactly what `sendMail` would hand the provider for `mail`: the sender, the reply-to, and for list mail the
 * footer with a link signed for `mail.to` and the RFC 8058 headers. Sends nothing, logs nothing and needs no
 * database: it does not check the suppression list, so it renders a mail `sendMail` would refuse as suppressed.
 * The links in it are credentials for `mail.to`. Throws only when the module is not enabled.
 */
export function previewMail(config: SoftureConfig, mail: OutgoingMail, options: PreviewMailOptions = {}): MailPreviewResult {
  const { env, ...sendOptions } = options;
  const validation = validateMail(mail, sendOptions);
  if (!validation.ok) return { ...err("mailing.invalid_input"), fields: validation.fields };
  const secret = readUnsubscribeSecrets(env).current;
  if (validation.value.kind !== TRANSACTIONAL_KIND && secret === null) return { ...err("mailing.unavailable"), cause: "no_unsubscribe_secret" };
  return ok(composeMessage(config, validation.value, secret));
}

const FAILURE_CODES: Readonly<Record<ProviderFailureStatus, MailingErrorCode>> = {
  rejected: "mailing.rejected",
  unavailable: "mailing.unavailable",
  refused: "mailing.provider_refused",
  quota_exceeded: "mailing.quota_exceeded",
};

type ListMailRefusal = { readonly error: "mailing.suppressed" | "mailing.unavailable"; readonly cause: string };

/**
 * Why a list mail must not go out, or `null` when it may. Fails closed: without the secret, or when the suppression
 * list cannot be read, nothing is sent.
 */
async function checkListMail(context: MailContext, mail: ValidMail, secret: string | null): Promise<ListMailRefusal | null> {
  if (context.db === undefined) {
    throw new Error("@softure-ai/mailing: list mail needs the database handle; call sendMail({ config, db }, ...)");
  }
  if (secret === null) {
    console.error(`mailing: list mail needs ${UNSUBSCRIBE_SECRET_ENV} (at least ${String(MIN_UNSUBSCRIBE_SECRET_LENGTH)} characters) to sign unsubscribe links`);
    return { error: "mailing.unavailable", cause: "no_unsubscribe_secret" };
  }
  try {
    return (await isSuppressed({ db: context.db }, mail.to)) ? { error: "mailing.suppressed", cause: "unsubscribed" } : null;
  } catch {
    // The error text can carry the query parameters, the recipient key among them.
    return { error: "mailing.unavailable", cause: "suppressions_unreadable" };
  }
}

/**
 * The message the provider receives: the configured sender, the mail's or the configured reply-to, and for list
 * mail the footer and headers signed with `secret` (which the caller checked is set).
 */
function composeMessage(config: SoftureConfig, mail: ValidMail, secret: string | null): ProviderMessage {
  const { from, replyTo } = getMailingOptions(config);
  const { idempotencyKey, kind, replyTo: mailReplyTo, ...content } = mail;
  const envelope = { from, replyTo: mailReplyTo ?? replyTo ?? null, idempotencyKey };
  if (kind === TRANSACTIONAL_KIND || secret === null) return { ...content, ...envelope };
  const links = buildUnsubscribeLinks(config, mail.to, secret);
  // The module factory merged the dictionaries; their shape is the module's own.
  const copy = (getMailingModule(config).messages[config.locale] as MailingMessages).footer;
  return {
    ...envelope,
    to: mail.to,
    subject: mail.subject,
    text: addTextFooter(mail.text, links, copy),
    html: mail.html === null ? null : addHtmlFooter(mail.html, links, copy),
    headers: { ...mail.headers, ...getListUnsubscribeHeaders(links) },
  };
}

/**
 * The provider's outcome, `unavailable` when it throws, answers something else or outlives the
 * timeout. The timer races the provider, so one that ignores its signal cannot hang the caller.
 */
async function callProvider(provider: MailProvider, message: Parameters<MailProvider["send"]>[0], timeoutMs: number): Promise<ProviderOutcome> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<ProviderOutcome>((resolve) => {
    timer = setTimeout(() => {
      controller.abort(new DOMException("mailing: the provider did not answer in time", "TimeoutError"));
      resolve({ status: "unavailable" });
    }, timeoutMs);
  });
  const sending = provider
    .send(message, { signal: controller.signal })
    .then(readOutcome, (): ProviderOutcome => ({ status: "unavailable" }));
  try {
    return await Promise.race([sending, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/** A provider's answer, narrowed: anything that is not a known outcome reads as `unavailable`. */
function readOutcome(outcome: unknown): ProviderOutcome {
  if (typeof outcome !== "object" || outcome === null) return { status: "unavailable" };
  const { status, id, httpStatus } = outcome as { status?: unknown; id?: unknown; httpStatus?: unknown };
  if (status === "sent") {
    return typeof id === "string" && id !== "" ? { status, id } : { status: "unavailable" };
  }
  if (typeof status === "string" && Object.hasOwn(FAILURE_CODES, status)) {
    const failure = status as ProviderFailureStatus;
    return isHttpStatus(httpStatus) ? { status: failure, httpStatus } : { status: failure };
  }
  return { status: "unavailable" };
}

function isHttpStatus(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 100 && value <= 599;
}

/**
 * The module's only log line. Deliberately takes nothing but the provider, the code, a status,
 * field names and a fixed cause: anything added "for diagnosis" is where an address leaks first.
 */
function logFailure(
  provider: MailProvider,
  code: MailingErrorCode,
  details: { readonly status?: number; readonly fields?: readonly string[]; readonly cause?: string },
): void {
  const parts = [`provider=${provider.name}`, `reason=${code.slice("mailing.".length)}`, `status=${details.status === undefined ? "none" : String(details.status)}`];
  if (details.fields !== undefined) parts.push(`fields=${details.fields.join(",")}`);
  if (details.cause !== undefined) parts.push(`cause=${details.cause}`);
  console.error(`mailing: send failed ${parts.join(" ")}`);
}
