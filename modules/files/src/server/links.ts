// Public links: `<route>/<id>/<expiry>/<generation>.<mac>/<name>`, where `expiry` is a Unix time in seconds,
// `generation` the file's link generation when the link was made and `mac` an HMAC-SHA256 (base64url) over all four
// parts under the keyring's first key. The MAC and the expiry are checked before any database read, so a forged or
// stale link costs no query; the generation is then compared with the row, so `revokeFileLinks` (which bumps it)
// kills every link made before.
import { createHmac, timingSafeEqual } from "node:crypto";
import { err, ok, type Err, type Ok } from "@softure-ai/core";
import { and, eq, isNull, sql, type SQL } from "drizzle-orm";
import type { FileLink, FilesKeyErrorCode } from "../contract.js";
import { files } from "../schema.js";
import type { FilesContext } from "./context.js";
import { findLiveRow, UUID_PATTERN, type FileLookupOptions } from "./files.js";
import { readLinkKeyring, type LinkKeyring } from "./keys.js";
import { sanitizeFileName } from "./names.js";
import { getFilesOptions, getLinksRoute } from "./options.js";

const MAC_CONTEXT = "softure-files-link/v1";
const MAC_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const EXPIRY_PATTERN = /^[1-9]\d{0,11}$/;
const GENERATION_PATTERN = /^[1-9]\d{0,9}$/;

export interface CreateFileLinkInput extends FileLookupOptions {
  /** How long the link works, at most `links.maxTtlSeconds`; a file that expires sooner ends the link with it. */
  readonly ttlSeconds: number;
  /** The name the receiver sees; the file's own name when omitted. Sanitised like a saved name. */
  readonly downloadName?: string;
}

export type CreateFileLinkResult = Ok<FileLink> | Err<"files.not_found" | "files.invalid_input" | FilesKeyErrorCode>;

/** A signed public link to a live file. */
export async function createFileLink(ctx: FilesContext, fileId: string, input: CreateFileLinkInput): Promise<CreateFileLinkResult> {
  const options = getFilesOptions(ctx.config);
  if (!Number.isSafeInteger(input.ttlSeconds) || input.ttlSeconds < 1 || input.ttlSeconds > options.links.maxTtlSeconds) {
    return err("files.invalid_input");
  }
  const keyring = readLinkKeyring(ctx.env ?? process.env);
  if (!keyring.ok) return keyring;
  const row = await findLiveRow(ctx, fileId, input);
  if (row === undefined) return err("files.not_found");

  const nowSeconds = Math.floor(ctx.clock.now().getTime() / 1000);
  const fileEndSeconds = row.expiresAt === null ? Infinity : Math.floor(row.expiresAt.getTime() / 1000);
  const expiry = Math.min(nowSeconds + input.ttlSeconds, fileEndSeconds);
  const name = input.downloadName === undefined ? row.originalName : sanitizeFileName(input.downloadName);
  const generation = String(row.linkGeneration);
  const mac = signLink(keyring.value.current, {
    fileId: row.id,
    expiry: String(expiry),
    generation,
    name,
  });
  const path = `${getLinksRoute(ctx.config)}/${row.id}/${String(expiry)}/${generation}.${mac}/${encodeURIComponent(name)}`;
  return ok({
    url: new URL(path, ctx.config.appOrigin).toString(),
    path,
    expiresAt: new Date(expiry * 1000),
  });
}

export type RevokeFileLinksResult = Ok<undefined> | Err<"files.not_found">;

/** Stops every link made so far for a file; links made afterwards work. */
export async function revokeFileLinks(ctx: FilesContext, fileId: string, options: FileLookupOptions = {}): Promise<RevokeFileLinksResult> {
  if (!UUID_PATTERN.test(fileId)) return err("files.not_found");
  const conditions: SQL[] = [eq(files.id, fileId), isNull(files.deletedAt)];
  if (options.ownerId !== undefined) conditions.push(eq(files.ownerId, options.ownerId));
  const updated = await ctx.db
    .update(files)
    .set({ linkGeneration: sql`${files.linkGeneration} + 1` })
    .where(and(...conditions))
    .returning({ id: files.id });
  return updated.length === 0 ? err("files.not_found") : ok();
}

/** What a link's path says, once its MAC and expiry are checked. */
export interface VerifiedLink {
  readonly fileId: string;
  readonly expiresAt: Date;
  readonly generation: number;
  readonly name: string;
}

export type VerifyFileLinkResult = Ok<VerifiedLink> | Err<"files.not_found" | FilesKeyErrorCode>;

/**
 * Checks a link path (the request's pathname) without touching the database: its shape, its MAC under any key of
 * the keyring, and that it has not expired. Every refusal of the link itself is `files.not_found`.
 */
export function verifyFileLink(ctx: Pick<FilesContext, "clock" | "config" | "env">, pathname: string): VerifyFileLinkResult {
  const parts = splitLinkPath(getLinksRoute(ctx.config), pathname);
  if (parts === null) return err("files.not_found");
  const keyring = readLinkKeyring(ctx.env ?? process.env);
  if (!keyring.ok) return keyring;
  if (!hasValidMac(keyring.value, parts)) return err("files.not_found");
  const expiresAt = new Date(Number(parts.expiry) * 1000);
  if (expiresAt.getTime() <= ctx.clock.now().getTime()) return err("files.not_found");
  return ok({
    fileId: parts.fileId,
    expiresAt,
    generation: Number(parts.generation),
    name: parts.name,
  });
}

interface LinkParts {
  readonly fileId: string;
  readonly expiry: string;
  readonly generation: string;
  readonly name: string;
}

interface SplitLink extends LinkParts {
  readonly mac: string;
}

function splitLinkPath(route: string, pathname: string): SplitLink | null {
  if (!pathname.startsWith(`${route}/`)) return null;
  const segments = pathname.slice(route.length + 1).split("/");
  if (segments.length !== 4) return null;
  const [fileId = "", expiry = "", signature = "", encodedName = ""] = segments;
  const [generation = "", mac = "", extra] = signature.split(".");
  const isWellFormed =
    UUID_PATTERN.test(fileId) && EXPIRY_PATTERN.test(expiry) && GENERATION_PATTERN.test(generation) && MAC_PATTERN.test(mac) && extra === undefined;
  if (!isWellFormed || encodedName === "") return null;
  try {
    return {
      fileId,
      expiry,
      generation,
      mac,
      name: decodeURIComponent(encodedName),
    };
  } catch {
    // A malformed percent escape: not a link this module made.
    return null;
  }
}

function signLink(key: Buffer, parts: LinkParts): string {
  return createHmac("sha256", key).update([MAC_CONTEXT, parts.fileId, parts.expiry, parts.generation, parts.name].join("\n")).digest("base64url");
}

function hasValidMac(keyring: LinkKeyring, parts: SplitLink): boolean {
  // Compared as text: a base64url MAC has spare bits, so decoded bytes would accept a few spellings of one MAC.
  const given = Buffer.from(parts.mac, "ascii");
  // Every key is tried, so the time taken does not tell which one matched.
  return keyring.keys.reduce((isMatch, key) => {
    const expected = Buffer.from(signLink(key, parts), "ascii");
    return timingSafeEqual(expected, given) || isMatch;
  }, false);
}
