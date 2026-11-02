// The link in a share. Many apps send it in `text` ("Look at this https://…") and leave `url` empty, so both fields
// are searched, `url` first.

const URL_CANDIDATE = /https?:\/\/[^\s<>"'`]+/gi;
const TRAILING_PUNCTUATION = new Set([".", ",", ";", ":", "!", "?", "'", '"', "]", "}", ">"]);

/**
 * Drops sentence punctuation after a link, and a closing parenthesis the link did not open. One pass from the end with
 * the parentheses counted once, so it stays linear on any input.
 */
function trimCandidate(candidate: string): string {
  let opens = 0;
  let closes = 0;
  for (const character of candidate) {
    if (character === "(") opens += 1;
    if (character === ")") closes += 1;
  }
  let end = candidate.length;
  for (;;) {
    const last = candidate.charAt(end - 1);
    if (end > 0 && TRAILING_PUNCTUATION.has(last)) end -= 1;
    else if (end > 0 && last === ")" && closes > opens) {
      end -= 1;
      closes -= 1;
    } else return candidate.slice(0, end);
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
