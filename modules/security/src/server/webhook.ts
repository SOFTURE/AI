// One route body for a third-party webhook, so the order of the checks is code, not prose: the size limit, the
// signature over the raw bytes, parsing and validating the event, then the delivery recorded and the app's work run
// in one transaction. Takes a web `Request` and returns a `Response`: on Next.js it is the route handler itself.
import { err, errorLogLabel, ok, type Err, type Ok } from "@softure-ai/core";
import type { z } from "zod";
import { readSmallBodyBytes } from "../read-small-body.js";
import { verifyWebhookSignature, type SigningSecret, type WebhookSender } from "../signed-request.js";
import type { SecurityContext } from "./rate-limit.js";
import { getSecurityOptions } from "./options.js";
import { assertSource, recordDeliveryOnce } from "./webhook-deliveries.js";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface HandleWebhookOptions<TEvent> {
  /** The app's constant name for the sender (the `recordDeliveryOnce` rule), e.g. `github`. */
  readonly source: string;
  /** The largest body accepted, in bytes. */
  readonly maxBytes: number;
  /** The sender's format: a preset from `WEBHOOK_SENDERS` or your own. */
  readonly sender: WebhookSender;
  /** The secret the provider issued, read by the app (`process.env.X`); undefined or empty refuses every request. */
  readonly secret: SigningSecret | undefined;
  /** Validates the parsed JSON; an event it refuses is answered 400 and nothing is recorded. */
  readonly schema: z.ZodType<TEvent>;
  /** The delivery id from the event, for a sender without `deliveryIdHeader`. */
  readonly deliveryId?: (event: TEvent) => string;
  /**
   * When the provider created the event, read from the validated event. An event older than
   * `webhookDeliveries.retentionDays` is answered 200 without `handle`: its ledger rows may be pruned already, so it
   * could be a captured delivery resent. Without it such a replay is processed again.
   */
  readonly eventTime?: (event: TEvent) => Date;
  /** The work, with the delivery's transaction as `ctx.db`. Throwing rolls the delivery back; the sender retries. */
  readonly handle: (event: TEvent, ctx: SecurityContext) => Promise<void>;
}

type WebhookAnswerCode =
  | "security.body_too_large"
  | "security.body_unreadable"
  | "security.signature_invalid"
  | "security.webhook_payload_invalid"
  | "security.delivery_id_invalid"
  | "security.webhook_failed";

const STATUS: Readonly<Record<WebhookAnswerCode, number>> = {
  "security.body_too_large": 413,
  "security.body_unreadable": 400,
  "security.signature_invalid": 401,
  "security.webhook_payload_invalid": 400,
  "security.delivery_id_invalid": 400,
  "security.webhook_failed": 500,
};

/**
 * Receives one webhook delivery and answers it: 200 when the work is done or the delivery is a replay; 413 or 400
 * when the body is too large or unreadable; 401 when the signature does not verify; 400
 * `security.webhook_payload_invalid` when the body is not JSON or the schema refuses it, and
 * `security.delivery_id_invalid` when the id is missing or malformed; 500 `security.webhook_failed` when `handle`
 * throws (logged, rolled back, so the sender's retry is processed). Error bodies are `{ error: <code> }`, never a
 * message. Nothing is parsed before the signature verifies and nothing is recorded before the event validates.
 *
 * Throws, before reading the request, when the module is not configured, `source` is malformed, or the sender has no
 * `deliveryIdHeader` and no `deliveryId` is given: all are configuration bugs.
 */
export async function handleWebhook<TEvent>(
  ctx: SecurityContext,
  request: Request,
  options: HandleWebhookOptions<TEvent>,
): Promise<Response> {
  getSecurityOptions(ctx.config);
  assertSource(options.source);
  const readDeliveryId = getDeliveryIdReader(request, options);
  const body = await readSmallBodyBytes(request, { maxBytes: options.maxBytes });
  if (!body.ok) {
    return answer(body.error);
  }
  const signed = await verifyWebhookSignature({
    ...options.sender,
    secret: options.secret,
    header: request.headers.get(options.sender.header),
    body: body.value,
  });
  if (!signed.ok) {
    return answer(signed.error);
  }
  const json = parseJson(body.value);
  const parsed = json.ok ? options.schema.safeParse(json.value) : undefined;
  if (parsed?.success !== true) {
    return answer("security.webhook_payload_invalid");
  }
  const event = parsed.data;
  if (options.eventTime !== undefined && isPastRetention(ctx, options.eventTime(event))) {
    return new Response(null, { status: 200 });
  }
  const delivery = { source: options.source, deliveryId: readDeliveryId(event) };
  // A header id is not signed: a captured delivery resent with a new id must still be a replay, so the signed bytes
  // are recorded too. An id read from the validated event is signed already.
  const bodyKey = options.deliveryId === undefined ? { source: options.source, deliveryId: await toBodyKey(body.value) } : undefined;

  try {
    return await ctx.db.transaction(async (tx) => {
      const txCtx = { ...ctx, db: tx };
      const recorded = await recordDeliveryOnce(txCtx, delivery);
      if (!recorded.ok) {
        return answer(recorded.error);
      }
      const isBodyNew = bodyKey === undefined || (await recordBodyOnce(txCtx, bodyKey));
      if (recorded.value && isBodyNew) {
        await options.handle(event, txCtx);
      }
      return new Response(null, { status: 200 });
    });
  } catch (error) {
    // The kind only: a query error's message carries its parameters, which can hold the event's personal data.
    console.error(`@softure-ai/security: webhook "${options.source}" failed: ${errorLogLabel(error)}`);
    return answer("security.webhook_failed");
  }
}

/** Whether an event is older than the ledger keeps ids; an invalid date counts as old, so it is never processed. */
function isPastRetention(ctx: SecurityContext, createdAt: Date): boolean {
  const { retentionDays } = getSecurityOptions(ctx.config).webhookDeliveries;
  const createdMs = createdAt.getTime();
  return Number.isNaN(createdMs) || createdMs < ctx.clock.now().getTime() - retentionDays * DAY_MS;
}

function getDeliveryIdReader<TEvent>(request: Request, options: HandleWebhookOptions<TEvent>): (event: TEvent) => string {
  if (options.deliveryId !== undefined) {
    return options.deliveryId;
  }
  const header = options.sender.deliveryIdHeader;
  if (header === undefined) {
    throw new RangeError(`handleWebhook: the sender of "${options.source}" has no deliveryIdHeader; pass deliveryId`);
  }
  return () => request.headers.get(header) ?? "";
}

/** The ledger key of the signed bytes: `sha256:<hex>`, 71 characters, within the delivery id rule. */
async function toBodyKey(body: Uint8Array): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new Uint8Array(body)));
  return `sha256:${Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

/** Whether the signed bytes are new; the key always fits the id rule, so a refusal is a bug. */
async function recordBodyOnce(ctx: SecurityContext, key: { readonly source: string; readonly deliveryId: string }): Promise<boolean> {
  const recorded = await recordDeliveryOnce(ctx, key);
  if (!recorded.ok) {
    throw new RangeError(`handleWebhook: the body key of "${key.source}" broke the delivery id rule`);
  }
  return recorded.value;
}

/** The JSON value of UTF-8 bytes; bytes that are not UTF-8 or not JSON are a payload the sender cannot fix by retrying. */
function parseJson(bytes: Uint8Array): Ok<unknown> | Err<"security.webhook_payload_invalid"> {
  try {
    return ok(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown);
  } catch {
    return err("security.webhook_payload_invalid");
  }
}

function answer(code: WebhookAnswerCode): Response {
  return Response.json({ error: code }, { status: STATUS[code] });
}
