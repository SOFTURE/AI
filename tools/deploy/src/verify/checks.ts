import type { HeaderChecks, VerifyRoute } from "./schema.js";

export type CheckKind = "request" | "source" | "status" | "contains" | "excludes" | "count" | "sha256" | "redirect" | "header";

/** One check of one route: what was expected and, when it failed, what came back. */
export interface CheckOutcome {
  kind: CheckKind;
  passed: boolean;
  detail: string;
}

/** What the runner saw: the status, the headers and (only when a check needs it) the body and its SHA-256 (hex). */
export interface ObservedResponse {
  requestUrl: string;
  status: number;
  getHeader: (name: string) => string | null;
  body: string | null;
  /** Absent or `null` when no digest was computed. */
  sha256?: string | null;
}

/** Global header checks with the route's own entries on top. */
export function mergeHeaderChecks(global: HeaderChecks, route: HeaderChecks): HeaderChecks {
  return { ...global, ...route };
}

/** `true` when a route's markers, counts or digest need the response body. */
export function needsBody(route: VerifyRoute): boolean {
  return route.contains.length > 0 || route.excludes.length > 0 || route.count !== undefined || route.sha256 !== undefined;
}

function quote(text: string): string {
  return JSON.stringify(text);
}

function checkStatus(route: VerifyRoute, response: ObservedResponse): CheckOutcome {
  const passed = response.status === route.status;
  return { kind: "status", passed, detail: passed ? `status ${route.status}` : `status ${response.status}, expected ${route.status}` };
}

/** The text between `<head…>` and `</head>` (case-insensitive); empty when the response has no head. */
export function getHeadText(body: string): string {
  const lower = body.toLowerCase();
  const open = /<head[\s>]/.exec(lower);
  if (open === null) return "";
  const start = lower.indexOf(">", open.index);
  const end = lower.indexOf("</head>", start);
  return end === -1 ? "" : body.slice(start + 1, end);
}

/** Non-overlapping occurrences of `marker` in `text`. */
export function countOccurrences(text: string, marker: string): number {
  let count = 0;
  for (let index = text.indexOf(marker); index !== -1; index = text.indexOf(marker, index + marker.length)) count += 1;
  return count;
}

function checkMarkers(route: VerifyRoute, body: string): CheckOutcome[] {
  const scope = route.within === "head" ? getHeadText(body) : body;
  const where = route.within === "head" ? " in <head>" : "";
  const present = route.contains.map((marker): CheckOutcome => {
    const passed = scope.includes(marker);
    return { kind: "contains", passed, detail: `${passed ? "contains" : "missing"} ${quote(marker)}${where}` };
  });
  const absent = route.excludes.map((marker): CheckOutcome => {
    const passed = !scope.includes(marker);
    return { kind: "excludes", passed, detail: `${passed ? "no" : "unexpected"} ${quote(marker)}${where}` };
  });
  const counted = Object.entries(route.count ?? {}).map(([marker, expected]): CheckOutcome => {
    const got = countOccurrences(scope, marker);
    const passed = got === expected;
    return { kind: "count", passed, detail: `${got} × ${quote(marker)}${where}${passed ? "" : `, expected ${expected}`}` };
  });
  return [...present, ...absent, ...counted];
}

/** The hex of a `sha256:<hex>` or bare-hex digest. */
export function toDigestHex(digest: string): string {
  return digest.startsWith("sha256:") ? digest.slice("sha256:".length) : digest;
}

function checkDigest(expected: string, response: ObservedResponse): CheckOutcome {
  const want = toDigestHex(expected);
  const passed = response.sha256 === want;
  return { kind: "sha256", passed, detail: passed ? "sha256 matches" : `sha256 ${response.sha256 ?? "-"}, expected ${want}` };
}

/** Resolves `text` against `base`; `null` when it is not a URL at all. */
function resolveUrl(text: string, base: string): string | null {
  try {
    return new URL(text, base).href;
  } catch {
    return null;
  }
}

/** A path on the verified host (`/new`), not a protocol-relative URL (`//other.host/`). */
function isHostPath(text: string): boolean {
  return text.startsWith("/") && !text.startsWith("//");
}

function checkRedirect(expected: string, response: ObservedResponse, baseUrl: string): CheckOutcome {
  const location = response.getHeader("location");
  const want = resolveUrl(isHostPath(expected) ? joinUrl(baseUrl, expected) : expected, baseUrl) ?? expected;
  if (location === null) return { kind: "redirect", passed: false, detail: `no location header, expected ${want}` };
  const got = resolveUrl(location, response.requestUrl) ?? location;
  const passed = got === want;
  return { kind: "redirect", passed, detail: passed ? `redirect to ${want}` : `redirect to ${got}, expected ${want}` };
}

function checkHeader(name: string, expected: string | null, response: ObservedResponse): CheckOutcome {
  const value = response.getHeader(name);
  if (expected === null) {
    const passed = value === null;
    return { kind: "header", passed, detail: passed ? `no ${name}` : `unexpected ${name}: ${quote(value ?? "")}` };
  }
  if (value === null) return { kind: "header", passed: false, detail: `missing ${name}, expected ${quote(expected)}` };
  const passed = value.toLowerCase().includes(expected.toLowerCase());
  return {
    kind: "header",
    passed,
    detail: passed ? `${name} has ${quote(expected)}` : `${name}: ${quote(value)}, expected ${quote(expected)}`,
  };
}

/** `text` without trailing slashes; a loop, not a regular expression, so a long run of `/` stays linear. */
export function trimTrailingSlashes(text: string): string {
  let end = text.length;
  while (end > 0 && text[end - 1] === "/") end -= 1;
  return text.slice(0, end);
}

/**
 * Joins a route path to the base URL, keeping a path prefix of the base (`https://host/app` + `/login` →
 * `https://host/app/login`).
 */
export function joinUrl(baseUrl: string, path: string): string {
  return `${trimTrailingSlashes(baseUrl)}${path}`;
}

/** Every check of one route against the response it got; pure, so each rule is tested without a server. */
export function checkResponse(options: {
  route: VerifyRoute;
  headers: HeaderChecks;
  response: ObservedResponse;
  baseUrl: string;
}): CheckOutcome[] {
  const { route, headers, response, baseUrl } = options;
  const outcomes = [checkStatus(route, response)];
  if (route.redirect !== undefined) outcomes.push(checkRedirect(route.redirect, response, baseUrl));
  if (needsBody(route)) outcomes.push(...checkMarkers(route, response.body ?? ""));
  if (route.sha256 !== undefined) outcomes.push(checkDigest(route.sha256, response));
  for (const [name, expected] of Object.entries(headers)) {
    // A list is one check per item, each reported like a single substring.
    for (const item of Array.isArray(expected) ? expected : [expected]) outcomes.push(checkHeader(name, item, response));
  }
  return outcomes;
}
