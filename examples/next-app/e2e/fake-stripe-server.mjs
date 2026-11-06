// @ts-check
// A stand-in for Stripe that the e2e runs locally (playwright.config.ts starts it), so the Stripe payment flow is tested
// on every pull request without Stripe's network: no live sandbox, no `stripe listen`, nothing an outage can break.
//
// It answers the calls stripe() of @softure-ai/billing makes (POST /v1/checkout/sessions) and the refund the test makes
// (POST /v1/refunds), hosts a minimal checkout page with a Pay button, and delivers the events Stripe would
// (`checkout.session.completed`, `charge.refunded`) to the app's webhook, signed the way Stripe signs them
// (`Stripe-Signature: t=<seconds>,v1=<HMAC-SHA256 of "<t>.<payload>">`). It also lists what it recorded
// (GET /v1/checkout/sessions/<id>), so the test checks the request the app sent. The live sandbox test
// (billing-checkout.stripe-sandbox.spec.ts) keeps Stripe's own behaviour covered every night.
//
// Environment: FAKE_STRIPE_PORT (default 3190), FAKE_STRIPE_WEBHOOK_URL (the app's /api/billing/webhook),
// STRIPE_WEBHOOK_SECRET (the secret the app checks).
import { createHmac, randomUUID } from "node:crypto";
import { createServer } from "node:http";

const PORT = Number(process.env.FAKE_STRIPE_PORT ?? 3190);
const WEBHOOK_URL = process.env.FAKE_STRIPE_WEBHOOK_URL ?? "";
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? "";
const ORIGIN = `http://localhost:${String(PORT)}`;

/**
 * @typedef {{ id: string, status: "open" | "complete", url: string, successUrl: string, cancelUrl: string,
 *   clientReferenceId: string, customerEmail: string, currency: string, amountTotal: number,
 *   metadata: Record<string, string>, paymentIntentMetadata: Record<string, string>, paymentIntent: string | null }} Session
 */

/** @type {Map<string, Session>} */
const sessions = new Map();

/**
 * The fields of a form body under `prefix[...]`, e.g. `metadata[user_id]` → `{ user_id }`.
 * @param {URLSearchParams} form
 * @param {string} prefix
 * @returns {Record<string, string>}
 */
function readNested(form, prefix) {
  /** @type {Record<string, string>} */
  const fields = {};
  for (const [key, value] of form) {
    if (key.startsWith(`${prefix}[`) && key.endsWith("]") && !key.slice(prefix.length + 1, -1).includes("[")) {
      fields[key.slice(prefix.length + 1, -1)] = value;
    }
  }
  return fields;
}

/**
 * @param {import("node:http").IncomingMessage} request
 * @returns {Promise<string>}
 */
async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  return Buffer.concat(chunks).toString("utf8");
}

/**
 * @param {import("node:http").ServerResponse} response
 * @param {number} status
 * @param {unknown} body
 */
function sendJson(response, status, body) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

/**
 * Stripe's error answer.
 * @param {import("node:http").ServerResponse} response
 * @param {number} status
 * @param {string} message
 */
function sendError(response, status, message) {
  sendJson(response, status, { error: { type: "invalid_request_error", message } });
}

/**
 * Delivers a Stripe event to the app's webhook, signed with the webhook secret. Throws when the app refuses it.
 * @param {string} type
 * @param {Record<string, unknown>} object
 */
async function deliverEvent(type, object) {
  const payload = JSON.stringify({ id: `evt_fake_${randomUUID()}`, object: "event", type, created: Math.floor(Date.now() / 1000), data: { object } });
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHmac("sha256", WEBHOOK_SECRET).update(`${String(timestamp)}.${payload}`, "utf8").digest("hex");
  const answer = await fetch(WEBHOOK_URL, {
    method: "POST",
    headers: { "content-type": "application/json", "stripe-signature": `t=${String(timestamp)},v1=${signature}` },
    body: payload,
  });
  if (!answer.ok) throw new Error(`deliverEvent: the webhook answered ${String(answer.status)} to ${type}`);
}

/**
 * POST /v1/checkout/sessions: records the session the app asks for and returns its hosted page.
 * @param {URLSearchParams} form
 * @returns {Session | string} the session, or why the request is refused
 */
function createSession(form) {
  const successUrl = form.get("success_url");
  const cancelUrl = form.get("cancel_url");
  const currency = form.get("line_items[0][price_data][currency]");
  const unitAmount = Number(form.get("line_items[0][price_data][unit_amount]"));
  const quantity = Number(form.get("line_items[0][quantity]") ?? "1");
  if (form.get("mode") !== "payment") return "mode must be payment";
  if (successUrl === null || cancelUrl === null) return "success_url and cancel_url are required";
  if (currency === null || !Number.isInteger(unitAmount) || unitAmount <= 0) return "line_items[0][price_data] needs a currency and a positive unit_amount";
  const id = `cs_test_fake_${randomUUID().replaceAll("-", "")}`;
  /** @type {Session} */
  const session = {
    id,
    status: "open",
    url: `${ORIGIN}/c/pay/${id}`,
    successUrl,
    cancelUrl,
    clientReferenceId: form.get("client_reference_id") ?? "",
    customerEmail: form.get("customer_email") ?? "",
    currency,
    amountTotal: unitAmount * quantity,
    metadata: readNested(form, "metadata"),
    paymentIntentMetadata: readNested(form, "payment_intent_data[metadata]"),
    paymentIntent: null,
  };
  sessions.set(id, session);
  return session;
}

/**
 * @param {Session} session
 */
function describeSession(session) {
  return {
    id: session.id,
    object: "checkout.session",
    url: session.url,
    status: session.status,
    mode: "payment",
    payment_status: session.status === "complete" ? "paid" : "unpaid",
    payment_intent: session.paymentIntent,
    amount_total: session.amountTotal,
    currency: session.currency,
    client_reference_id: session.clientReferenceId,
    customer_email: session.customerEmail,
    success_url: session.successUrl,
    cancel_url: session.cancelUrl,
    metadata: session.metadata,
    payment_intent_data: { metadata: session.paymentIntentMetadata },
  };
}

/**
 * The hosted page: the amount and a Pay button that completes the payment.
 * @param {Session} session
 */
function renderCheckoutPage(session) {
  const amount = `${(session.amountTotal / 100).toFixed(2)} ${session.currency.toUpperCase()}`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Fake Stripe Checkout</title></head><body>
<main><h1>Fake Stripe Checkout</h1><p data-amount>${amount}</p>
<form method="post" action="/c/pay/${session.id}"><button type="submit">Pay</button></form>
<a href="${session.cancelUrl}">Back</a></main></body></html>`;
}

/**
 * POST /c/pay/<id>: the buyer paid; Stripe delivers `checkout.session.completed` and sends the buyer to success_url.
 * @param {Session} session
 */
async function completeSession(session) {
  session.status = "complete";
  session.paymentIntent = `pi_fake_${randomUUID().replaceAll("-", "")}`;
  await deliverEvent("checkout.session.completed", describeSession(session));
}

/**
 * POST /v1/refunds: refunds the whole payment and delivers `charge.refunded`.
 * @param {string} paymentIntent
 * @returns {Promise<Record<string, unknown> | null>} the refund, or null for an unknown payment
 */
async function refundPayment(paymentIntent) {
  const session = [...sessions.values()].find((candidate) => candidate.paymentIntent === paymentIntent);
  if (session === undefined) return null;
  await deliverEvent("charge.refunded", {
    id: `ch_fake_${paymentIntent.slice("pi_fake_".length)}`,
    object: "charge",
    payment_intent: paymentIntent,
    amount: session.amountTotal,
    amount_refunded: session.amountTotal,
    currency: session.currency,
    refunded: true,
    metadata: session.paymentIntentMetadata,
  });
  return { id: `re_fake_${randomUUID().replaceAll("-", "")}`, object: "refund", payment_intent: paymentIntent, amount: session.amountTotal, status: "succeeded" };
}

/**
 * @param {import("node:http").IncomingMessage} request
 * @param {import("node:http").ServerResponse} response
 */
async function handle(request, response) {
  const url = new URL(request.url ?? "/", ORIGIN);
  const method = request.method ?? "GET";
  if (method === "GET" && url.pathname === "/health") return sendJson(response, 200, { ok: true });
  const pagePath = /^\/c\/pay\/([A-Za-z0-9_]+)$/.exec(url.pathname);
  if (pagePath !== null) {
    const session = sessions.get(pagePath[1] ?? "");
    if (session === undefined) return sendError(response, 404, "No such checkout session");
    if (method === "GET") {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      return response.end(renderCheckoutPage(session));
    }
    if (method === "POST") {
      if (session.status !== "open") return sendError(response, 400, "This checkout session is already complete");
      await completeSession(session);
      response.writeHead(303, { location: session.successUrl });
      return response.end();
    }
  }
  if (url.pathname.startsWith("/v1/")) {
    const authorization = request.headers.authorization ?? "";
    if (!/^Bearer (sk|rk)_test_\S+$/.test(authorization)) return sendError(response, 401, "Invalid API key: a test-mode key is required");
  }
  if (method === "POST" && url.pathname === "/v1/checkout/sessions") {
    const created = createSession(new URLSearchParams(await readBody(request)));
    return typeof created === "string" ? sendError(response, 400, created) : sendJson(response, 200, describeSession(created));
  }
  const sessionPath = /^\/v1\/checkout\/sessions\/([A-Za-z0-9_]+)$/.exec(url.pathname);
  if (method === "GET" && sessionPath !== null) {
    const session = sessions.get(sessionPath[1] ?? "");
    return session === undefined ? sendError(response, 404, "No such checkout session") : sendJson(response, 200, describeSession(session));
  }
  if (method === "POST" && url.pathname === "/v1/refunds") {
    const paymentIntent = new URLSearchParams(await readBody(request)).get("payment_intent") ?? "";
    const refund = await refundPayment(paymentIntent);
    return refund === null ? sendError(response, 404, `No such payment_intent: ${paymentIntent}`) : sendJson(response, 200, refund);
  }
  return sendError(response, 404, `Unrecognized request URL (${method}: ${url.pathname})`);
}

if (WEBHOOK_URL === "" || WEBHOOK_SECRET === "") {
  console.error("fake-stripe-server: set FAKE_STRIPE_WEBHOOK_URL and STRIPE_WEBHOOK_SECRET");
  process.exit(1);
}

createServer((request, response) => {
  handle(request, response).catch((/** @type {unknown} */ error) => {
    console.error(`fake-stripe-server: ${request.method ?? "?"} ${request.url ?? "?"} failed:`, error);
    if (!response.headersSent) sendError(response, 500, error instanceof Error ? error.message : String(error));
    else response.end();
  });
}).listen(PORT, () => {
  console.log(`fake-stripe-server: listening on ${ORIGIN}, delivering to ${WEBHOOK_URL}`);
});
