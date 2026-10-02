// Where to go after login. `next` comes from the query string, so anyone can craft it: only a path
// on this app is accepted, never another origin (`//evil.example`, `/\evil.example`, `https://…`).
const BASE = "http://softure.invalid";
const MAX_LENGTH = 2048;

/** `candidate` when it is a same-origin path, else `fallback`. */
export function toSafeNextPath(candidate: unknown, fallback: string): string {
  if (typeof candidate !== "string" || candidate.length > MAX_LENGTH) return fallback;
  if (!candidate.startsWith("/") || candidate.startsWith("//") || candidate.startsWith("/\\")) return fallback;
  // eslint-disable-next-line no-control-regex -- control characters are exactly what is refused
  if (/[\u0000-\u001f\u007f\\]/.test(candidate)) return fallback;
  const url = new URL(candidate, BASE);
  if (url.origin !== BASE) return fallback;
  return `${url.pathname}${url.search}${url.hash}`;
}
