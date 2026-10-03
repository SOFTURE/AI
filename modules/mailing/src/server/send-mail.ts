// Sends one mail through the configured provider. Ported from FIRE_TRACKER `src/lib/mail.ts` with
// its three rules: it never throws for a failed send (every failure is a result), nothing of the
// mail (address, subject, body, key) reaches a log or the result, and `headers` cannot replace the
// envelope or the sender.
import { err, ok, type SoftureConfig } from "@softure-ai/core";
import type { MailingErrorCode, MailProvider, OutgoingMail, ProviderOutcome, SendMailOptions, SendMailResult } from "../contract.js";
import { getMailingOptions } from "./options.js";
import { validateMail } from "./validate-mail.js";

/** What `sendMail` needs: the app's configuration. */
export interface MailContext {
  readonly config: SoftureConfig;
}

/**
 * Sends `mail` and resolves with the provider's message id or a `mailing.*` code:
 * `invalid_input` (fix the input), `rejected` (do not retry), `unavailable` (retry later with the
 * same `idempotencyKey`). Throws only when the module is not enabled.
 */
export async function sendMail(context: MailContext, mail: OutgoingMail, options: SendMailOptions = {}): Promise<SendMailResult> {
  const { from, replyTo, provider, timeoutMs } = getMailingOptions(context.config);

  const validation = validateMail(mail, options);
  if (!validation.ok) {
    logFailure(provider, "mailing.invalid_input", { fields: validation.fields });
    return err("mailing.invalid_input");
  }

  const { idempotencyKey, ...content } = validation.value;
  const outcome = await callProvider(provider, { ...content, from, replyTo: replyTo ?? null, idempotencyKey }, timeoutMs);
  if (outcome.status === "sent") {
    return ok({ id: outcome.id, provider: provider.name });
  }
  const code: MailingErrorCode = `mailing.${outcome.status}`;
  logFailure(provider, code, { status: outcome.httpStatus });
  return err(code);
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
 * The module's only log line. Deliberately takes nothing but the provider, the code, a status and
 * field names: anything added "for diagnosis" is where an address leaks first.
 */
function logFailure(provider: MailProvider, code: MailingErrorCode, details: { readonly status?: number; readonly fields?: readonly string[] }): void {
  const parts = [`provider=${provider.name}`, `reason=${code.slice("mailing.".length)}`, `status=${details.status === undefined ? "none" : String(details.status)}`];
  if (details.fields !== undefined) parts.push(`fields=${details.fields.join(",")}`);
  console.error(`mailing: send failed ${parts.join(" ")}`);
}
