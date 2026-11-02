// Upload URLs: `<route>/<id>/<expiry>.<mac>`, where `expiry` is the session's expiry as a Unix time in seconds and
// `mac` an HMAC-SHA256 (base64url) over both under the link keyring's first key, with a context string of its own so
// an upload MAC never passes as a link MAC. The MAC and the expiry are checked before any database read, so a forged
// or stale URL costs no query.
import { createHmac, timingSafeEqual } from "node:crypto";
import { err, ok, type Err, type Ok } from "@softure-ai/core";
import type { FilesKeyErrorCode } from "../contract.js";
import type { FilesContext } from "./context.js";
import { UUID_PATTERN } from "./files.js";
import { readLinkKeyring, type LinkKeyring } from "./keys.js";
import { getUploadsRoute } from "./options.js";

const MAC_CONTEXT = "softure-files-upload/v1";
const TOKEN_PATTERN = /^([1-9]\d{0,11})\.([A-Za-z0-9_-]{43})$/;

/** The path of a session's upload URL. */
export function signUploadPath(ctx: Pick<FilesContext, "config">, keyring: LinkKeyring, uploadId: string, expiresAt: Date): string {
  const expiry = String(Math.floor(expiresAt.getTime() / 1000));
  return `${getUploadsRoute(ctx.config)}/${uploadId}/${expiry}.${signUpload(keyring.current, uploadId, expiry)}`;
}

/** The session an upload path is for, once its MAC and expiry are checked. Every refusal of the URL is `files.not_found`. */
export function verifyUploadPath(ctx: Pick<FilesContext, "clock" | "config" | "env">, pathname: string): Ok<string> | Err<"files.not_found" | FilesKeyErrorCode> {
  const route = getUploadsRoute(ctx.config);
  if (!pathname.startsWith(`${route}/`)) return err("files.not_found");
  const segments = pathname.slice(route.length + 1).split("/");
  const [uploadId = "", token = ""] = segments;
  const match = TOKEN_PATTERN.exec(token);
  if (segments.length !== 2 || !UUID_PATTERN.test(uploadId) || match === null) return err("files.not_found");
  const [, expiry = "", mac = ""] = match;
  const keyring = readLinkKeyring(ctx.env ?? process.env);
  if (!keyring.ok) return keyring;
  const given = Buffer.from(mac, "ascii");
  // Every key is tried, so the time taken does not tell which one matched.
  const isValid = keyring.value.keys.reduce((isMatch, key) => timingSafeEqual(Buffer.from(signUpload(key, uploadId, expiry), "ascii"), given) || isMatch, false);
  if (!isValid) return err("files.not_found");
  if (Number(expiry) * 1000 <= ctx.clock.now().getTime()) return err("files.not_found");
  return ok(uploadId);
}

function signUpload(key: Buffer, uploadId: string, expiry: string): string {
  return createHmac("sha256", key).update([MAC_CONTEXT, uploadId, expiry].join("\n")).digest("base64url");
}
