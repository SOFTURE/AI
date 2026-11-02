// The link in a share. Many apps send it in `text` ("Look at this https://…") and leave `url` empty, so both fields
// are searched, `url` first.

const URL_CANDIDATE = /https?:\/\/[^\s<>"'`]+/gi;
const TRAILING_PUNCTUATION = /[.,;:!?'"\]}>]+$/;

/** Drops sentence punctuation after a link, and a closing parenthesis the link did not open. */
function trimCandidate(candidate: string): string {
  let value = candidate;
  for (;;) {
    const trimmed = value.replace(TRAILING_PUNCTUATION, "");
    const opens = trimmed.split("(").length - 1;
    const closes = trimmed.split(")").length - 1;
    const next = trimmed.endsWith(")") && closes > opens ? trimmed.slice(0, -1) : trimmed;
    if (next === value) return value;
    value = next;
  }
}

function parseHttpUrl(candidate: string): string | null {
  try {
    const url = new URL(candidate);
    if ((url.protocol !== "http:" && url.protocol !== "https:") || url.hostname.length === 0) return null;
    return url.href;
  } catch {
    return null;
  }
}

/** The first http(s) link in `url`, then in `text`, normalized (`new URL(…).href`); null when there is none. */
export function findSharedUrl(share: { readonly url: string | null; readonly text: string | null }): string | null {
  for (const field of [share.url, share.text]) {
    if (field === null) continue;
    for (const match of field.matchAll(URL_CANDIDATE)) {
      const url = parseHttpUrl(trimCandidate(match[0]));
      if (url !== null) return url;
    }
  }
  return null;
}
