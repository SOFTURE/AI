// Who is counted. A client is its address, as the configured resolvers see it; a subject (an
// email, a user id) is a separate key in its own bucket, never glued to the address: `ip|email`
// gives a flood a fresh bucket per email, and an attack on one account a fresh bucket per address.
import { createHash } from "node:crypto";
import { err, ok, type Err, type ModuleContext, type Ok } from "@softure-ai/core";
import { normalizeIp, toClientKey } from "../client-ip.js";
import { getSecurityOptions } from "./options.js";

const SUBJECT_HASH_LENGTH = 32;

/**
 * The rate limit key of the client that sent these headers, from the first resolver that finds a
 * valid address. Without one the result is `security.client_unidentified`, and the caller refuses
 * the request: counting every unidentified client in one shared bucket would let one of them lock
 * out all the others. Only an app that chose a shared fallback (`unidentified: { key }`, for a stack
 * with no edge in front) gets `unidentified:<key>` instead.
 */
export function identifyClient(
  ctx: Pick<ModuleContext, "config">,
  headers: Headers,
): Ok<string> | Err<"security.client_unidentified"> {
  const options = getSecurityOptions(ctx.config);
  for (const resolve of options.clientIp) {
    const found = resolve(headers);
    const address = found === null ? null : normalizeIp(found);
    if (address !== null) {
      return ok(toClientKey(address, options.ipv6Subnet));
    }
  }
  if (options.unidentified !== "refuse") {
    return ok(`unidentified:${options.unidentified.key}`);
  }
  return err("security.client_unidentified");
}

/**
 * The rate limit key of a subject, such as an email or a user id. The subject is stored as a
 * SHA-256 prefix, so the table holds no email addresses. Normalise it first (trim, lowercase an
 * email) when two spellings must count as one.
 */
export function subjectKey(subject: string): string {
  if (subject.length === 0) {
    throw new RangeError("subjectKey: the subject must not be empty");
  }
  const digest = createHash("sha256").update(subject, "utf8").digest("hex");
  return `subject:${digest.slice(0, SUBJECT_HASH_LENGTH)}`;
}
