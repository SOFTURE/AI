// `GET|POST <action>`: the share target's route. The system opens it in the installed app with what the user shared;
// the route reads the link, text and title, hands the files on as they stream in, and lets the app's `handle` answer
// where to go next (303). A signed-out user goes to the sign-in page, which returns to this route with the link and
// text.
import {
  isAcceptedFile,
  isSameOriginPath,
  resolveShareTarget,
  type ResolvedShareTarget,
  type ShareTargetOptions,
} from "../share/share-target.js";
import { findSharedUrl } from "../share/shared-url.js";
import { getMultipartBoundary, MultipartError, readMultipart, readTextPart, type MultipartPart } from "../share/multipart.js";

/** A shared file: read `body` (e.g. as `saveFile`'s body) before asking for the next file, or it is skipped. */
export interface SharedFile {
  /** The form field it came in. */
  readonly field: string;
  /** The file name the system sent (unsanitized; `saveFile` keeps only its last part, sanitized). */
  readonly name: string;
  /** The part's type, `application/octet-stream` when the system sent none. */
  readonly contentType: string;
  readonly body: AsyncIterable<Uint8Array>;
}

/** What the user shared. */
export interface SharedContent {
  /** The first http(s) link in the `url` field, else in `text`; null when there is none. */
  readonly url: string | null;
  /** The `text` field as sent (it often holds the link too); null when empty. */
  readonly text: string | null;
  readonly title: string | null;
  /** The accepted files, in order, streamed. Empty for a `GET` share. */
  readonly files: AsyncIterable<SharedFile>;
}

export interface ShareHandleContext<TUser> {
  /** The signed-in user from `getUser`; null when the route has no `getUser`. */
  readonly user: TUser;
  readonly request: Request;
}

/** Signed-in shares only: a signed-out share goes to `signInPath` with the link and text kept in `returnParam`. */
interface SignedInShareOptions<TUser> {
  /** The signed-in user from the request's cookies, or null. */
  readonly getUser: (request: Request) => Promise<TUser | null>;
  /** The sign-in page, a same-origin path, e.g. `/login`. */
  readonly signInPath: string;
  /** The query parameter the sign-in page returns to: `next` by default (auth's). */
  readonly returnParam?: string;
}

interface ShareRouteBaseOptions<TUser> {
  /** The same options the manifest route takes (`createManifestRoute({ shareTarget })`). */
  readonly shareTarget: ShareTargetOptions;
  /** The app's action: stores the share (a job, `saveFile` for the files) and answers a same-origin path to go to. */
  readonly handle: (context: ShareHandleContext<TUser>, share: SharedContent) => Promise<string>;
  /** The most files handed on per share; later ones are skipped. 10 by default. */
  readonly maxFiles?: number;
  /** The longest `url`, `text` or `title` value in bytes: 16 KiB by default; a longer one is a 413. */
  readonly maxFieldBytes?: number;
}

export type ShareTargetRouteOptions<TUser> = ShareRouteBaseOptions<TUser> &
  (SignedInShareOptions<TUser> | { readonly getUser?: never; readonly signInPath?: never; readonly returnParam?: never });

export interface ShareTargetRoute {
  /** A text-only share, and a share coming back from the sign-in page. */
  readonly GET: (request: Request) => Promise<Response>;
  /** A share with files (`multipart/form-data`). */
  readonly POST: (request: Request) => Promise<Response>;
}

type TextFields = Readonly<Record<"url" | "text" | "title", string | null>>;

const DEFAULT_MAX_FILES = 10;
const DEFAULT_MAX_FIELD_BYTES = 16 * 1024;
const OCTET_STREAM = "application/octet-stream";
const ROLES = ["url", "text", "title"] as const;

function answer(status: number): Response {
  return new Response(null, { status, headers: { "cache-control": "no-store" } });
}

function redirectTo(path: string): Response {
  return new Response(null, { status: 303, headers: { location: path, "cache-control": "no-store" } });
}

function toValue(value: string | null): string | null {
  return value === null || value.trim().length === 0 ? null : value;
}

function checkPositiveInteger(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(`@softure-ai/pwa: ${name} must be a positive integer, got ${String(value)}`);
  return value;
}

/** The share's path again, with its link, text and title, for the sign-in page to return to. */
function getResumePath(target: ResolvedShareTarget, fields: TextFields): string {
  const query = new URLSearchParams();
  for (const role of ROLES) {
    const value = fields[role];
    if (value !== null) query.set(target.params[role], value);
  }
  const search = query.toString();
  return search.length === 0 ? target.action : `${target.action}?${search}`;
}

function getSignInRedirect(signInPath: string, returnParam: string, resumePath: string): string {
  const url = new URL(signInPath, "http://share.invalid");
  url.searchParams.set(returnParam, resumePath);
  return `${url.pathname}${url.search}`;
}

/** The text fields before the first file part, and that part (or null). Null when a field is over `maxBytes`. */
async function readLeadingFields(
  parts: AsyncGenerator<MultipartPart, void, undefined>,
  target: ResolvedShareTarget,
  maxBytes: number,
): Promise<{ fields: TextFields; firstFile: MultipartPart | null } | null> {
  const fields: Record<"url" | "text" | "title", string | null> = { url: null, text: null, title: null };
  for (let next = await parts.next(); next.done !== true; next = await parts.next()) {
    const part = next.value;
    if (part.fileName !== null) return { fields, firstFile: part };
    const role = ROLES.find((candidate) => target.params[candidate] === part.name);
    if (role === undefined || fields[role] !== null) continue;
    const value = await readTextPart(part, maxBytes);
    if (value === null) return null;
    fields[role] = toValue(value);
  }
  return { fields, firstFile: null };
}

/** The accepted files: from `first` on, declared fields and accepted types only, at most `maxFiles`. */
async function* streamFiles(
  first: MultipartPart | null,
  parts: AsyncGenerator<MultipartPart, void, undefined>,
  target: ResolvedShareTarget,
  maxFiles: number,
): AsyncGenerator<SharedFile, void, undefined> {
  let count = 0;
  let part: MultipartPart | null = first;
  while (part !== null && count < maxFiles) {
    const field = target.files.find((candidate) => candidate.name === part?.name);
    if (part.fileName !== null && field !== undefined) {
      const file = { field: part.name, name: part.fileName, contentType: part.contentType ?? OCTET_STREAM };
      if (isAcceptedFile(field.accept, file)) {
        count += 1;
        yield { ...file, body: part.body };
      }
    }
    const next = await parts.next();
    part = next.done === true ? null : next.value;
  }
}

const NO_FILES: AsyncIterable<SharedFile> = {
  async *[Symbol.asyncIterator]() {
    // A GET share carries no files.
  },
};

/**
 * The share target's route: `export const { GET, POST } = createShareTargetRoute({ shareTarget, handle })` in
 * `app/<action>/route.ts`. The options are checked when the module loads, so a wrong option fails the build.
 */
export function createShareTargetRoute<TUser = null>(options: ShareTargetRouteOptions<TUser>): ShareTargetRoute {
  const target = resolveShareTarget(options.shareTarget);
  const maxFiles = checkPositiveInteger(options.maxFiles ?? DEFAULT_MAX_FILES, "maxFiles");
  const maxFieldBytes = checkPositiveInteger(options.maxFieldBytes ?? DEFAULT_MAX_FIELD_BYTES, "maxFieldBytes");
  const returnParam = options.returnParam ?? "next";
  if (options.getUser !== undefined && !isSameOriginPath(options.signInPath)) {
    throw new Error(`@softure-ai/pwa: signInPath must be a same-origin path, got "${options.signInPath}"`);
  }

  /** The user, or the sign-in redirect for a signed-out share. */
  async function getUserOrRedirect(request: Request, fields: () => Promise<TextFields | null>): Promise<{ user: TUser } | Response> {
    if (options.getUser === undefined) return { user: null as TUser };
    const user = await options.getUser(request);
    if (user !== null) return { user };
    const kept = await fields();
    if (kept === null) return answer(413);
    return redirectTo(getSignInRedirect(options.signInPath, returnParam, getResumePath(target, kept)));
  }

  async function runHandle(context: ShareHandleContext<TUser>, share: SharedContent): Promise<Response> {
    const path = await options.handle(context, share);
    // A path elsewhere would make the share an open redirect: a bug in the app's handle.
    if (!isSameOriginPath(path)) throw new Error(`@softure-ai/pwa: the share handle must answer a same-origin path, got "${path}"`);
    return redirectTo(path);
  }

  return {
    async GET(request) {
      const query = new URL(request.url).searchParams;
      const fields: TextFields = {
        url: toValue(query.get(target.params.url)),
        text: toValue(query.get(target.params.text)),
        title: toValue(query.get(target.params.title)),
      };
      if (ROLES.some((role) => (fields[role]?.length ?? 0) > maxFieldBytes)) return answer(413);
      const signedIn = await getUserOrRedirect(request, () => Promise.resolve(fields));
      if (signedIn instanceof Response) return signedIn;
      return runHandle({ user: signedIn.user, request }, { url: findSharedUrl(fields), text: fields.text, title: fields.title, files: NO_FILES });
    },

    async POST(request) {
      const boundary = getMultipartBoundary(request.headers.get("content-type"));
      if (boundary === null || request.body === null) return answer(415);
      const parts = readMultipart(request.body, boundary);
      let leading: ReturnType<typeof readLeadingFields> | null = null;
      // Read once, after the user is known: a signed-out share needs only the text fields.
      const readLeading = (): ReturnType<typeof readLeadingFields> => (leading ??= readLeadingFields(parts, target, maxFieldBytes));
      try {
        const signedIn = await getUserOrRedirect(request, async () => (await readLeading())?.fields ?? null);
        if (signedIn instanceof Response) return signedIn;
        const read = await readLeading();
        if (read === null) return answer(413);
        const share: SharedContent = {
          url: findSharedUrl(read.fields),
          text: read.fields.text,
          title: read.fields.title,
          files: streamFiles(read.firstFile, parts, target, maxFiles),
        };
        return await runHandle({ user: signedIn.user, request }, share);
      } catch (error) {
        if (error instanceof MultipartError) return answer(400);
        throw error;
      } finally {
        // Whatever `handle` left unread is dropped with the request body.
        await parts.return(undefined);
      }
    },
  };
}
