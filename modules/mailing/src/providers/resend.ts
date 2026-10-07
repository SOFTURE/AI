// The Resend adapter (https://resend.com/docs/api-reference/emails/send-email). Ported from
// FIRE_TRACKER `src/lib/mail.ts`, where the sender, reply-to and timeout were constants; here they
// come from the module options and `sendMail` owns validation, the timeout and the log line.
import type { MailProvider, ProviderMessage, ProviderOutcome } from "../contract.js";

export const RESEND_ENDPOINT = "https://api.resend.com/emails";
export const RESEND_API_KEY_ENV = "RESEND_API_KEY";

export interface ResendOptions {
  /**
   * The API key. Default: `process.env.RESEND_API_KEY`, read on every send, so the configuration
   * loads at build time without the secret.
   */
  readonly apiKey?: string;
  /** Default: Resend's `POST /emails`. For a proxy or a test server. */
  readonly endpoint?: string;
  /** Injected in tests; default: the global `fetch`. */
  readonly fetch?: typeof fetch;
}

/** Resend's name for an idempotency key that another request is still using: retry later. */
const CONCURRENT_IDEMPOTENT_REQUESTS = "concurrent_idempotent_requests";

/** Resend's name for a 429 that is a per-second rate limit; any other 429 is a spent daily or monthly quota. */
const RATE_LIMIT_EXCEEDED = "rate_limit_exceeded";

/** Statuses that refuse the sender (missing, invalid or restricted key, account not allowed to send). */
const REFUSED_STATUSES: ReadonlySet<number> = new Set([401, 403]);

/** Sends through Resend's HTTP API. */
export function resend(options: ResendOptions = {}): MailProvider {
  const endpoint = options.endpoint ?? RESEND_ENDPOINT;
  return {
    name: "resend",
    send: async (message, { signal }) => {
      const apiKey = (options.apiKey ?? process.env[RESEND_API_KEY_ENV] ?? "").trim();
      if (apiKey === "") {
        // A deployment without the key cannot send anything until it is set; never a caller error.
        console.error(`mailing: resend has no API key; set ${RESEND_API_KEY_ENV} or pass resend({ apiKey })`);
        return { status: "unavailable" };
      }
      const fetchImpl = options.fetch ?? fetch;
      const response = await fetchImpl(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          ...(message.idempotencyKey === null ? {} : { "Idempotency-Key": message.idempotencyKey }),
        },
        body: JSON.stringify(toResendBody(message)),
        signal,
        cache: "no-store",
      });
      return readOutcome(response);
    },
  };
}

function toResendBody(message: ProviderMessage): Record<string, unknown> {
  return {
    from: message.from,
    to: [message.to],
    subject: message.subject,
    text: message.text,
    ...(message.html === null ? {} : { html: message.html }),
    ...(message.replyTo === null ? {} : { reply_to: message.replyTo }),
    ...(Object.keys(message.headers).length === 0 ? {} : { headers: message.headers }),
  };
}

async function readOutcome(response: Response): Promise<ProviderOutcome> {
  const payload: unknown = await response.json().catch(() => null);
  if (response.ok) {
    const id = readString(payload, "id");
    return id === null ? { status: "unavailable", httpStatus: response.status } : { status: "sent", id };
  }
  // Only the error's `name` (an enum) is read: its `message` can echo the address back.
  const name = readString(payload, "name");
  const httpStatus = response.status;
  if (REFUSED_STATUSES.has(httpStatus)) return { status: "refused", httpStatus };
  if (httpStatus === 429) return { status: name === RATE_LIMIT_EXCEEDED ? "unavailable" : "quota_exceeded", httpStatus };
  const isRetryable = httpStatus >= 500 || httpStatus === 408 || (httpStatus === 409 && name === CONCURRENT_IDEMPOTENT_REQUESTS);
  return { status: isRetryable ? "unavailable" : "rejected", httpStatus };
}

function readString(payload: unknown, key: string): string | null {
  if (typeof payload !== "object" || payload === null || !Object.hasOwn(payload, key)) return null;
  const value: unknown = (payload as Record<string, unknown>)[key];
  return typeof value === "string" && value !== "" ? value : null;
}
