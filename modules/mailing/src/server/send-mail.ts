// Sends one mail through the configured provider. Ported from FIRE_TRACKER `src/lib/mail.ts` with
// its three rules: it never throws for a failed send (every failure is a result), nothing of the
// mail (address, subject, body, key) reaches a log or the result, and `headers` cannot replace the
// envelope or the sender. List mail (any kind but `transactional`) also gets a signed unsubscribe
// link in a footer and the RFC 8058 headers, and is refused for a recipient who unsubscribed.
import { err, ok, type SoftureConfig } from "@softure-ai/core";
import type { Queryable } from "@softure-ai/db";
import { TRANSACTIONAL_KIND, type MailingErrorCode, type MailProvider, type OutgoingMail, type ProviderMessage, type ProviderOutcome, type SendMailOptions, type SendMailResult } from "../contract.js";
import type { MailingMessages } from "../messages/index.js";
import { addHtmlFooter, addTextFooter, getListUnsubscribeHeaders } from "./list-mail.js";
import { getMailingModule, getMailingOptions } from "./options.js";
import { isSuppressed } from "./suppressions.js";
import { buildUnsubscribeLinks, MIN_UNSUBSCRIBE_SECRET_LENGTH, readUnsubscribeSecrets, UNSUBSCRIBE_SECRET_ENV } from "./unsubscribe-link.js";
import { validateMail, type ValidMail } from "./validate-mail.js";

/**
 * What `sendMail` needs: the app's configuration and, for list mail, the database handle (the
 * suppression check reads it). Transactional mail needs no `db`.
 */
export interface MailContext {
  readonly config: SoftureConfig;
  readonly db?: Queryable;
}

type MailContent = Omit<ProviderMessage, "from" | "replyTo" | "idempotencyKey">;

/**
 * Sends `mail` and resolves with the provider's message id or a `mailing.*` code:
 * `invalid_input` (fix the input), `rejected` (do not retry), `unavailable` (retry later with the
 * same `idempotencyKey`), `suppressed` (a list mail to someone who unsubscribed; do not retry).
 * Throws only when the module is not enabled, or for list mail without `context.db`.
 */
export async function sendMail(context: MailContext, mail: OutgoingMail, options: SendMailOptions = {}): Promise<SendMailResult> {
  const { from, replyTo, provider, timeoutMs } = getMailingOptions(context.config);

  const validation = validateMail(mail, options);
  if (!validation.ok) {
    logFailure(provider, "mailing.invalid_input", { fields: validation.fields });
    return err("mailing.invalid_input");
  }

  const { idempotencyKey, kind, ...content } = validation.value;
  let message: MailContent = content;
  if (kind !== TRANSACTIONAL_KIND) {
    const listMail = await prepareListMail(context, validation.value);
    if (!listMail.ok) {
      logFailure(provider, listMail.error, { cause: listMail.cause });
      return err(listMail.error);
    }
    message = listMail.value;
  }

  const outcome = await callProvider(provider, { ...message, from, replyTo: replyTo ?? null, idempotencyKey }, timeoutMs);
  if (outcome.status === "sent") {
    return ok({ id: outcome.id, provider: provider.name });
  }
  const code: MailingErrorCode = `mailing.${outcome.status}`;
  logFailure(provider, code, { status: outcome.httpStatus });
  return err(code);
}

type ListMailResult =
  | { readonly ok: true; readonly value: MailContent }
  | { readonly ok: false; readonly error: "mailing.suppressed" | "mailing.unavailable"; readonly cause: string };

/**
 * A list mail with its footer and headers, or why it must not go out. Fails closed: without the
 * secret, or when the suppression list cannot be read, nothing is sent.
 */
async function prepareListMail(context: MailContext, mail: ValidMail): Promise<ListMailResult> {
  if (context.db === undefined) {
    throw new Error("@softure-ai/mailing: list mail needs the database handle; call sendMail({ config, db }, ...)");
  }
  const secret = readUnsubscribeSecrets().current;
  if (secret === null) {
    console.error(`mailing: list mail needs ${UNSUBSCRIBE_SECRET_ENV} (at least ${String(MIN_UNSUBSCRIBE_SECRET_LENGTH)} characters) to sign unsubscribe links`);
    return { ok: false, error: "mailing.unavailable", cause: "no_unsubscribe_secret" };
  }
  let suppressed: boolean;
  try {
    suppressed = await isSuppressed({ db: context.db }, mail.to);
  } catch {
    // The error text can carry the query parameters, the recipient key among them.
    return { ok: false, error: "mailing.unavailable", cause: "suppressions_unreadable" };
  }
  if (suppressed) return { ok: false, error: "mailing.suppressed", cause: "unsubscribed" };

  const links = buildUnsubscribeLinks(context.config, mail.to, secret);
  // The module factory merged the dictionaries; their shape is the module's own.
  const copy = (getMailingModule(context.config).messages[context.config.locale] as MailingMessages).footer;
  return {
    ok: true,
    value: {
      to: mail.to,
      subject: mail.subject,
      text: addTextFooter(mail.text, links, copy),
      html: mail.html === null ? null : addHtmlFooter(mail.html, links, copy),
      headers: { ...mail.headers, ...getListUnsubscribeHeaders(links) },
    },
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
  if (status === "rejected" || status === "unavailable") {
    return typeof httpStatus === "number" ? { status, httpStatus } : { status };
  }
  return { status: "unavailable" };
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
