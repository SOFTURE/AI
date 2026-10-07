// Where to go after login. `next` comes from the query string, so anyone can craft it: only a path
// on this app is accepted, never another origin (`//evil.example`, `/\evil.example`, `https://…`).
const BASE = "http://softure.invalid";
/** Room for an OAuth authorize URL (state, PKCE challenge, resource, scope) under common URL limits. */
export const MAX_NEXT_PATH_LENGTH = 8192;

/** `candidate` when it is a same-origin path, else `fallback`. A path over the cap is logged by length. */
export function toSafeNextPath(candidate: unknown, fallback: string): string {
  if (typeof candidate !== "string") return fallback;
  if (candidate.length > MAX_NEXT_PATH_LENGTH) {
    // The length only: the path may carry tokens.
    console.warn(`@softure-ai/auth: a next path of ${String(candidate.length)} characters is over the ${String(MAX_NEXT_PATH_LENGTH)} limit; using the fallback`);
    return fallback;
  }
  if (!candidate.startsWith("/") || candidate.startsWith("//") || candidate.startsWith("/\\")) return fallback;
  // eslint-disable-next-line no-control-regex -- control characters are exactly what is refused
  if (/[\u0000-\u001f\u007f\\]/.test(candidate)) return fallback;
  const url = new URL(candidate, BASE);
  if (url.origin !== BASE) return fallback;
  return `${url.pathname}${url.search}${url.hash}`;
}
