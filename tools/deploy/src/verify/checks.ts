import type { HeaderChecks, VerifyRoute } from "./schema.js";

export type CheckKind = "request" | "status" | "contains" | "excludes" | "redirect" | "header";

/** One check of one route: what was expected and, when it failed, what came back. */
export interface CheckOutcome {
  kind: CheckKind;
  passed: boolean;
  detail: string;
}

/** What the runner saw: the status, the headers and (only when a marker needs it) the body. */
export interface ObservedResponse {
  requestUrl: string;
  status: number;
  getHeader: (name: string) => string | null;
  body: string | null;
}

/** Global header checks with the route's own entries on top. */
export function mergeHeaderChecks(global: HeaderChecks, route: HeaderChecks): HeaderChecks {
  return { ...global, ...route };
}

/** `true` when a route's markers need the response body. */
export function needsBody(route: VerifyRoute): boolean {
  return route.contains.length > 0 || route.excludes.length > 0;
}

function quote(text: string): string {
  return JSON.stringify(text);
}

function checkStatus(route: VerifyRoute, response: ObservedResponse): CheckOutcome {
  const passed = response.status === route.status;
  return { kind: "status", passed, detail: passed ? `status ${route.status}` : `status ${response.status}, expected ${route.status}` };
}

function checkMarkers(route: VerifyRoute, body: string): CheckOutcome[] {
  const present = route.contains.map((marker): CheckOutcome => {
    const passed = body.includes(marker);
    return { kind: "contains", passed, detail: passed ? `contains ${quote(marker)}` : `missing ${quote(marker)}` };
  });
  const absent = route.excludes.map((marker): CheckOutcome => {
    const passed = !body.includes(marker);
    return { kind: "excludes", passed, detail: passed ? `no ${quote(marker)}` : `unexpected ${quote(marker)}` };
  });
  return [...present, ...absent];
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

/**
 * Joins a route path to the base URL, keeping a path prefix of the base (`https://host/app` + `/login` →
 * `https://host/app/login`).
 */
export function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, "")}${path}`;
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
  for (const [name, expected] of Object.entries(headers)) outcomes.push(checkHeader(name, expected, response));
  return outcomes;
}
