// The share target: one set of options the app passes to both the manifest route and the share route, so the
// manifest's `share_target` and the fields the route reads never disagree.

/** The form field names of the share's roles; each defaults to its role's name. */
export interface ShareTargetParams {
  readonly url?: string;
  readonly text?: string;
  readonly title?: string;
}

/** A file field: its form field name and the MIME types (`image/*`, `application/pdf`) or extensions (`.pdf`) it takes. */
export interface ShareTargetFiles {
  readonly name: string;
  readonly accept: readonly string[];
}

export interface ShareTargetOptions {
  /** The route that receives the share, a same-origin path inside the manifest's scope, e.g. `/share`. */
  readonly action: string;
  /** The field names; `url`, `text` and `title` by default. */
  readonly params?: ShareTargetParams;
  /** File fields. With files the share is a `POST` of `multipart/form-data`, without them a `GET`. */
  readonly files?: readonly ShareTargetFiles[];
}

/** The options with every default applied, checked once. */
export interface ResolvedShareTarget {
  readonly action: string;
  readonly params: Readonly<Record<"url" | "text" | "title", string>>;
  readonly files: readonly ShareTargetFiles[];
  readonly method: "GET" | "POST";
}

/** The manifest member (W3C Web Share Target). */
export interface ManifestShareTarget {
  readonly action: string;
  readonly method: "GET" | "POST";
  readonly enctype?: "multipart/form-data";
  readonly params: {
    readonly url: string;
    readonly text: string;
    readonly title: string;
    readonly files?: readonly { readonly name: string; readonly accept: readonly string[] }[];
  };
}

const MIME_PATTERN = /^[a-z0-9!#$&^_.+-]+\/(?:\*|[a-z0-9!#$&^_.+-]+)$/i;
const EXTENSION_PATTERN = /^\.[a-z0-9][a-z0-9_+-]*$/i;

/** Whether a value is a path on this origin: `/x`, never `//x` or `/\x`, and no scheme. */
export function isSameOriginPath(value: string): boolean {
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return false;
  // Control characters and spaces: a browser drops some of them, which could turn the path into `//host`.
  return ![...value].some((character) => character.charCodeAt(0) <= 0x20 || character === "\u007f");
}

/** Applies the defaults and checks the options; a wrong option throws, so it fails the build where the route loads. */
export function resolveShareTarget(options: ShareTargetOptions): ResolvedShareTarget {
  if (!isSameOriginPath(options.action) || options.action.includes("?") || options.action.includes("#")) {
    throw new Error(`@softure-ai/pwa: shareTarget.action must be a same-origin path without a query, got "${options.action}"`);
  }
  const params = {
    url: options.params?.url ?? "url",
    text: options.params?.text ?? "text",
    title: options.params?.title ?? "title",
  };
  const files = options.files ?? [];
  const names = [...Object.values(params), ...files.map((file) => file.name)];
  for (const name of names) {
    if (name.trim().length === 0) throw new Error("@softure-ai/pwa: shareTarget field names must not be empty");
  }
  if (new Set(names).size !== names.length) {
    throw new Error(`@softure-ai/pwa: shareTarget field names must be unique, got ${names.join(", ")}`);
  }
  for (const file of files) {
    if (file.accept.length === 0) throw new Error(`@softure-ai/pwa: shareTarget file field "${file.name}" accepts nothing`);
    for (const entry of file.accept) {
      if (!MIME_PATTERN.test(entry) && !EXTENSION_PATTERN.test(entry)) {
        throw new Error(`@softure-ai/pwa: shareTarget file field "${file.name}" has an invalid accept entry "${entry}"`);
      }
    }
  }
  return { action: options.action, params, files, method: files.length > 0 ? "POST" : "GET" };
}

/** The manifest's `share_target`: a `GET` for text only, a `POST` of `multipart/form-data` when files are accepted. */
export function buildManifestShareTarget(options: ShareTargetOptions): ManifestShareTarget {
  const target = resolveShareTarget(options);
  if (target.method === "GET") return { action: target.action, method: "GET", params: target.params };
  return {
    action: target.action,
    method: "POST",
    enctype: "multipart/form-data",
    params: { ...target.params, files: target.files.map((file) => ({ name: file.name, accept: [...file.accept] })) },
  };
}

/** Whether a file field takes a file: its type matches a MIME entry (`image/*` too), or its name ends in an extension entry. */
export function isAcceptedFile(accept: readonly string[], file: { readonly contentType: string; readonly name: string }): boolean {
  const type = (file.contentType.split(";", 1)[0] ?? "").trim().toLowerCase();
  const name = file.name.toLowerCase();
  return accept.some((entry) => {
    const pattern = entry.toLowerCase();
    if (pattern.startsWith(".")) return name.endsWith(pattern);
    if (pattern.endsWith("/*")) return type.startsWith(pattern.slice(0, -1));
    return type === pattern;
  });
}
