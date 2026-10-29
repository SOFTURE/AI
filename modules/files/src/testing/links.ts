// Link helpers for tests: a fixed keyring, a request to a link through the same code the route runs, and the
// expiry a link carries.
import type { FilesContext } from "../server/context.js";
import { FILES_LINK_KEYS_ENV } from "../server/keys.js";
import { serveFileLink } from "../server/serve.js";

/**
 * An environment with a link keyring of the given key ids (first one signs), each key derived from its id, so two
 * calls agree: `env: createTestLinkKeys(["new", "old"])`. Never for production.
 */
export function createTestLinkKeys(ids: readonly string[] = ["test"]): Readonly<Record<string, string>> {
  const entries = ids.map((id) => `${id}:${Buffer.alloc(32, `softure-files-test-${id}`).toString("base64url")}`);
  return { [FILES_LINK_KEYS_ENV]: entries.join(",") };
}

export interface FetchFileLinkOptions {
  readonly method?: "GET" | "HEAD";
  /** A `Range` header value, e.g. `bytes=0-99`. */
  readonly range?: string;
}

/** What a link answered, with the body read. */
export interface FileLinkAnswer {
  readonly status: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: Uint8Array;
}

/** Requests a link (a URL or a path) as the route would serve it, at the context's clock. */
export async function fetchFileLink(ctx: FilesContext, link: string, options: FetchFileLinkOptions = {}): Promise<FileLinkAnswer> {
  const url = new URL(link, ctx.config.appOrigin);
  const headers: Record<string, string> = options.range === undefined ? {} : { range: options.range };
  const response = await serveFileLink(ctx, new Request(url, { method: options.method ?? "GET", headers }));
  return {
    status: response.status,
    headers: Object.fromEntries(response.headers.entries()),
    body: new Uint8Array(await response.arrayBuffer()),
  };
}

/** The expiry a link carries in its path (it may still die earlier: revoked, deleted). */
export function readFileLinkExpiry(link: string): Date {
  const segments = new URL(link, "http://localhost").pathname.split("/");
  const expiry = segments.at(-3);
  if (expiry === undefined || !/^\d+$/.test(expiry)) throw new RangeError("readFileLinkExpiry: not a file link");
  return new Date(Number(expiry) * 1000);
}
