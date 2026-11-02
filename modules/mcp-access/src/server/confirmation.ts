// Confirmed tool calls: the `--commit` rule over MCP for a tool that spends money or cannot be undone. A call
// without `confirmation` only runs the estimate and answers it with a confirmation token; the assistant shows the
// estimate, the person agrees in the chat, and a second call with the same arguments and the token does the work.
//
//   server.registerTool("render_film", { inputSchema: { scene: z.string(), confirmation: confirmationInput } },
//     withConfirmation((args) => renderFilm(ctx, identity.userId, args), {
//       ctx, identity, tool: "render_film",
//       estimate: (args) => estimateFilm(ctx, identity.userId, args), // { total: 12, currency: "credits", ... }
//     }));
//
// The token is a stateless HMAC (`MCP_CONFIRMATION_SECRET`) over the tool, a digest of the canonical JSON of the
// arguments, a digest of the account and access token, the estimate's total and an expiry. Its payload carries
// those digests in the clear, so each mismatch gets its own code after the signature has been checked. It is
// single use: the confirmed call stores its hash (`mcp.used_confirmations`) before the work runs.
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { formatMessage } from "@softure-ai/core";
import { lte } from "drizzle-orm";
import { z } from "zod";
import type { McpServerIdentity } from "../contract.js";
import { en } from "../messages/en.js";
import { usedConfirmations } from "../schema.js";
import { getMcpAccessMessages } from "./options.js";
import type { McpAccessContext } from "./tokens.js";
import { withToolErrors, type ToolCaller, type ToolCallHook, type ToolErrorHints } from "./tools.js";
import type { CallToolResult } from "@modelcontextprotocol/server";

/** The argument that carries the token on the confirmed call. */
export const CONFIRMATION_FIELD = "confirmation";

/** Signs and verifies confirmation tokens. */
export const CONFIRMATION_SECRET_ENV = "MCP_CONFIRMATION_SECRET";

/** A shorter secret counts as missing: a guessable key lets anyone mint a confirmation. */
export const MIN_CONFIRMATION_SECRET_LENGTH = 32;

/** How long a confirmation stays valid by default: fifteen minutes. */
export const DEFAULT_CONFIRMATION_TTL_SECONDS = 900;

/** The longest token the check looks at; a real one is about 300 characters. */
const MAX_CONFIRMATION_LENGTH = 2048;

/** The `confirmation` field for the tool's input schema, so a strict server lists and accepts it. */
export const confirmationInput = z.string().max(MAX_CONFIRMATION_LENGTH).optional().describe(en.confirmation.fieldDescription);

/** The stable codes of a refused confirmed call. */
export type ConfirmationErrorCode =
  | "input.confirmation_invalid"
  | "input.confirmation_other_tool"
  | "input.confirmation_other_account"
  | "input.confirmation_expired"
  | "input.confirmation_arguments_changed"
  | "input.confirmation_estimate_changed"
  | "input.confirmation_used";

/** What a call would do and cost: `total` is bound to the token; every other field is shown to the person as it is. */
export interface ConfirmationEstimate {
  readonly total: number;
}

/** The answer of a call that needs the person's yes first. */
export interface ConfirmationRequest<Estimate extends ConfirmationEstimate = ConfirmationEstimate> {
  readonly needsConfirmation: true;
  readonly estimate: Estimate;
  readonly confirmation: string;
  /** ISO 8601. */
  readonly expiresAt: string;
  /** The fixed sentence that tells the assistant to ask the person before calling again. */
  readonly message: string;
}

/** The tool's arguments as the SDK passes them, `confirmation` included. */
export type ConfirmedToolArgs<Args> = Args & { readonly confirmation?: string | undefined };

export interface WithConfirmationOptions<Args, Estimate extends ConfirmationEstimate> {
  /** The module context: the database for the used tokens, the clock for the expiry, the config for the copy. */
  readonly ctx: McpAccessContext;
  /** The request's identity, as the server factory got it: the token is bound to its account and access token. */
  readonly identity: Pick<McpServerIdentity, "userId" | "tokenId">;
  /** The tool's registered name, also its label in the log line and the `onToolCall` record. */
  readonly tool: string;
  /** What the call would do and cost, without doing it. Runs on both calls; the second must give the same total. */
  readonly estimate: (args: Args) => Estimate | Promise<Estimate>;
  /** How long the person has to agree. Default: 900 seconds. */
  readonly ttlSeconds?: number;
  /** Runs the handler at once, without asking, when this answers true, e.g. `(estimate) => estimate.total === 0`. */
  readonly runWithoutConfirmationWhen?: (estimate: Estimate) => boolean;
  /** Default: `process.env.MCP_CONFIRMATION_SECRET`, read on every call. */
  readonly secret?: string;
  /** Texts per error code, as in `withToolErrors`; they also replace the refusal texts of the dictionary. */
  readonly hints?: ToolErrorHints;
  /** Called once after each call with its record (`confirmed` included), as in `withToolErrors`. */
  readonly onToolCall?: ToolCallHook;
  /** Who called, for the record, as in `withToolErrors`. */
  readonly caller?: ToolCaller;
}

/** The token's signed payload. Short keys keep the token short. */
interface ConfirmationPayload {
  /** Format version. */
  readonly v: 1;
  /** Tool name. */
  readonly t: string;
  /** sha256 of the canonical JSON of the arguments without `confirmation`. */
  readonly a: string;
  /** sha256 of the user id and the access token id. */
  readonly c: string;
  /** The estimate's total. */
  readonly n: number;
  /** Expiry, epoch seconds. */
  readonly e: number;
  /** A random nonce, so two estimates of the same input are two tokens. */
  readonly r: string;
}

/**
 * Domain separation: the same key signing anything else can never produce a valid confirmation. Changing it voids
 * every token in flight, exactly like changing the key.
 */
const SIGNED_PREFIX = "softure.mcp-access.confirmation.v1:";

const TOKEN_PATTERN = /^([A-Za-z0-9_-]{1,2000})\.([A-Za-z0-9_-]{43})$/;
const DIGEST_PATTERN = /^[A-Za-z0-9_-]{43}$/;

const payloadSchema = z.strictObject({
  v: z.literal(1),
  t: z.string().min(1).max(128),
  a: z.string().regex(DIGEST_PATTERN),
  c: z.string().regex(DIGEST_PATTERN),
  n: z.number().finite(),
  e: z.number().int().positive(),
  r: z.string().regex(/^[A-Za-z0-9_-]{16,64}$/),
});

/**
 * The tool callback for `server.registerTool(name, { inputSchema: { ...fields, confirmation: confirmationInput } },
 * withConfirmation(handler, options))`. Without `confirmation` it runs `estimate` only and answers a
 * `ConfirmationRequest` (or runs the handler when `runWithoutConfirmationWhen` says so); with a valid one it runs
 * the handler with the arguments without `confirmation`. A refusal answers its `input.confirmation_*` text.
 */
export function withConfirmation<Args extends Readonly<Record<string, unknown>>, Estimate extends ConfirmationEstimate>(
  handler: (args: Args) => unknown,
  options: WithConfirmationOptions<Args, Estimate>,
): (args: ConfirmedToolArgs<Args>) => Promise<CallToolResult> {
  return async (input) => {
    const { [CONFIRMATION_FIELD]: confirmation, ...rest } = input;
    const args = rest as unknown as Args;
    let confirmed = false;
    const recordOptions = {
      label: options.tool,
      args: rest,
      hints: { ...getRefusalTexts(options.ctx), ...options.hints },
      // Read after the work, when the call has decided whether it ran on a confirmation.
      get confirmed(): boolean {
        return confirmed;
      },
      ...(options.onToolCall === undefined ? {} : { onToolCall: options.onToolCall }),
      ...(options.caller === undefined ? {} : { caller: options.caller }),
    };
    return withToolErrors(async () => {
      const secret = readConfirmationSecret(options);
      const estimate = await runEstimate(options, args);
      if (confirmation === undefined) {
        if (options.runWithoutConfirmationWhen?.(estimate) === true) return handler(args);
        return requestConfirmation(options, args, estimate, secret);
      }
      const refusal = await checkConfirmation(options, { token: confirmation, args, estimate, secret });
      if (refusal !== null) return { ok: false, error: refusal };
      confirmed = true;
      return handler(args);
    }, recordOptions);
  };
}

/** Deletes the used tokens past their expiry; a daily job through `pruneMcpAccess`. */
export async function pruneUsedConfirmations(ctx: McpAccessContext): Promise<number> {
  const removed = await ctx.db
    .delete(usedConfirmations)
    .where(lte(usedConfirmations.expiresAt, ctx.clock.now()))
    .returning({ tokenHash: usedConfirmations.tokenHash });
  return removed.length;
}

function readConfirmationSecret(options: { readonly secret?: string; readonly tool: string }): string {
  const secret = options.secret ?? process.env[CONFIRMATION_SECRET_ENV];
  if (secret !== undefined && secret.length >= MIN_CONFIRMATION_SECRET_LENGTH) return secret;
  // The boundary logs a thrown error by its kind only, so the cause is named here once.
  console.error(`@softure-ai/mcp-access: tool ${options.tool} needs ${CONFIRMATION_SECRET_ENV} (at least ${String(MIN_CONFIRMATION_SECRET_LENGTH)} characters)`);
  throw new Error(`@softure-ai/mcp-access: ${CONFIRMATION_SECRET_ENV} is missing or shorter than ${String(MIN_CONFIRMATION_SECRET_LENGTH)} characters`);
}

async function runEstimate<Args, Estimate extends ConfirmationEstimate>(options: WithConfirmationOptions<Args, Estimate>, args: Args): Promise<Estimate> {
  const estimate = await options.estimate(args);
  if (typeof estimate !== "object" || estimate === null || typeof estimate.total !== "number" || !Number.isFinite(estimate.total)) {
    throw new Error(`@softure-ai/mcp-access: the estimate of tool ${options.tool} has no finite numeric total`);
  }
  return estimate;
}

function requestConfirmation<Args, Estimate extends ConfirmationEstimate>(
  options: WithConfirmationOptions<Args, Estimate>,
  args: Args,
  estimate: Estimate,
  secret: string,
): ConfirmationRequest<Estimate> {
  const ttlSeconds = options.ttlSeconds ?? DEFAULT_CONFIRMATION_TTL_SECONDS;
  const expiresAtSeconds = Math.floor(options.ctx.clock.now().getTime() / 1000) + Math.max(1, Math.floor(ttlSeconds));
  const payload: ConfirmationPayload = {
    v: 1,
    t: options.tool,
    a: digestArguments(args),
    c: digestCaller(options.identity),
    n: estimate.total,
    e: expiresAtSeconds,
    r: randomBytes(16).toString("base64url"),
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const expiresAt = new Date(expiresAtSeconds * 1000).toISOString();
  return {
    needsConfirmation: true,
    estimate,
    confirmation: `${encoded}.${sign(encoded, secret)}`,
    expiresAt,
    message: formatMessage(getMcpAccessMessages(options.ctx.config).confirmation.ask, { expiresAt }),
  };
}

interface ConfirmationCheck<Args, Estimate> {
  readonly token: string;
  readonly args: Args;
  readonly estimate: Estimate;
  readonly secret: string;
}

/**
 * The refusal code, or null when the call may run. The signature is checked first, so no field of the payload is
 * trusted before it; the token is consumed last, so a refused call never uses up a valid confirmation.
 */
async function checkConfirmation<Args, Estimate extends ConfirmationEstimate>(
  options: WithConfirmationOptions<Args, Estimate>,
  check: ConfirmationCheck<Args, Estimate>,
): Promise<ConfirmationErrorCode | null> {
  const payload = readSignedPayload(check.token, check.secret);
  if (payload === null) return "input.confirmation_invalid";
  if (payload.t !== options.tool) return "input.confirmation_other_tool";
  if (payload.c !== digestCaller(options.identity)) return "input.confirmation_other_account";
  const now = options.ctx.clock.now();
  if (now.getTime() >= payload.e * 1000) return "input.confirmation_expired";
  if (payload.a !== digestArguments(check.args)) return "input.confirmation_arguments_changed";
  if (payload.n !== check.estimate.total) return "input.confirmation_estimate_changed";
  const inserted = await options.ctx.db
    .insert(usedConfirmations)
    .values({ tokenHash: createHash("sha256").update(check.token).digest("hex"), usedAt: now, expiresAt: new Date(payload.e * 1000) })
    .onConflictDoNothing()
    .returning({ tokenHash: usedConfirmations.tokenHash });
  return inserted.length === 0 ? "input.confirmation_used" : null;
}

/** The payload of a token this secret signed, else null. Never throws. */
function readSignedPayload(token: string, secret: string): ConfirmationPayload | null {
  if (token.length > MAX_CONFIRMATION_LENGTH) return null;
  const match = TOKEN_PATTERN.exec(token);
  if (match === null) return null;
  const [, encoded = "", signature = ""] = match;
  // Both are 43 characters of base64url (the pattern), so the buffers have the same length.
  if (!timingSafeEqual(Buffer.from(sign(encoded, secret)), Buffer.from(signature))) return null;
  let decoded: unknown;
  try {
    decoded = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  } catch {
    // Signed by this secret but unreadable: only a key shared with another signer could produce that.
    return null;
  }
  const parsed = payloadSchema.safeParse(decoded);
  return parsed.success ? parsed.data : null;
}

function sign(encoded: string, secret: string): string {
  return createHmac("sha256", secret).update(`${SIGNED_PREFIX}${encoded}`).digest("base64url");
}

function digestArguments(args: unknown): string {
  return createHash("sha256").update(toCanonicalJson(args)).digest("base64url");
}

function digestCaller(identity: Pick<McpServerIdentity, "userId" | "tokenId">): string {
  return createHash("sha256").update(JSON.stringify([identity.userId, identity.tokenId])).digest("base64url");
}

/** JSON with every object's keys sorted and `undefined` fields left out, so equal arguments give equal text. */
export function toCanonicalJson(value: unknown): string {
  return JSON.stringify(sortKeys(value)) ?? "null";
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => (item === undefined ? null : sortKeys(item)));
  if (value instanceof Date) return value.toISOString();
  if (typeof value !== "object" || value === null) return value;
  const entries = Object.entries(value)
    .filter(([, item]) => item !== undefined)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
  return Object.fromEntries(entries.map(([key, item]) => [key, sortKeys(item)]));
}

/** The dictionary's refusal texts per code, with the app's overrides. */
function getRefusalTexts(ctx: McpAccessContext): Record<ConfirmationErrorCode, string> {
  const texts = getMcpAccessMessages(ctx.config).confirmation;
  return {
    "input.confirmation_invalid": texts.invalid,
    "input.confirmation_other_tool": texts.otherTool,
    "input.confirmation_other_account": texts.otherAccount,
    "input.confirmation_expired": texts.expired,
    "input.confirmation_arguments_changed": texts.argumentsChanged,
    "input.confirmation_estimate_changed": texts.estimateChanged,
    "input.confirmation_used": texts.used,
  };
}
