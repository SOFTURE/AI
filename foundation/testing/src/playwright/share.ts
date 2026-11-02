import type { Page } from "@playwright/test";

/** A file in a share, as the system sends it: the form field, the file name, its type and its bytes. */
export interface SharedTestFile {
  readonly field: string;
  readonly name: string;
  readonly mimeType: string;
  readonly buffer: Buffer | string;
}

export interface ShareToAppOptions {
  /** The manifest's `share_target.action`, e.g. `/share`. */
  readonly action: string;
  /** The form fields by their names (the manifest's `params`), e.g. `{ url: "https://…", text: "…" }`. */
  readonly fields?: Readonly<Record<string, string>>;
  /** Files: the share becomes a `POST` of `multipart/form-data`. */
  readonly files?: readonly SharedTestFile[];
  /** `GET` without files, `POST` with them, as the manifest declares. */
  readonly method?: "GET" | "POST";
}

export interface ShareAnswer {
  /** The share route's own status, before any redirect is followed (303 when it hands the page on). */
  readonly status: number;
  /** Where the route sent the page (its `Location`, resolved), or null when it did not redirect. */
  readonly location: string | null;
}

/**
 * Shares to the installed app the way Android's share sheet does: a `GET` opens the action with the fields as its
 * query; a `POST` sends `multipart/form-data` with the fields first and then the files, with the page's cookies, and
 * the page then opens where the route redirected. Resolves the route's own answer; the page is on the redirect's
 * target (or on the action, for a `GET` that did not redirect).
 */
export async function shareToApp(page: Page, options: ShareToAppOptions): Promise<ShareAnswer> {
  const fields = Object.entries(options.fields ?? {});
  const files = options.files ?? [];
  const method = options.method ?? (files.length > 0 ? "POST" : "GET");
  if (method === "GET" && files.length > 0) throw new Error("shareToApp: a GET share carries no files; use method POST");

  if (method === "GET") {
    const query = new URLSearchParams(fields).toString();
    const response = await page.goto(query.length === 0 ? options.action : `${options.action}?${query}`);
    if (response === null) throw new Error(`shareToApp: opening ${options.action} gave no response`);
    // Playwright follows redirects; the first request of the chain got the route's own answer.
    const last = response.request();
    let first = last;
    for (let previous = first.redirectedFrom(); previous !== null; previous = previous.redirectedFrom()) first = previous;
    if (first === last) return { status: response.status(), location: null };
    const routeAnswer = await first.response();
    return { status: routeAnswer?.status() ?? response.status(), location: response.url() };
  }

  const form = new FormData();
  for (const [name, value] of fields) form.append(name, value);
  for (const file of files) form.append(file.field, new File([typeof file.buffer === "string" ? file.buffer : new Uint8Array(file.buffer)], file.name, { type: file.mimeType }));
  const response = await page.request.post(options.action, { multipart: form, maxRedirects: 0 });
  const header = response.headers().location;
  if (header === undefined) return { status: response.status(), location: null };
  const location = new URL(header, response.url()).href;
  await page.goto(location);
  return { status: response.status(), location };
}
