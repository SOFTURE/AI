// A scripted `fetch` for tests of code that takes an injected `fetch` (core's `requestJson`, API clients). Each
// route matches a method and a URL and answers once (or every time with `repeat`); every call is recorded, and a
// call no route answers rejects and is kept, so `expectAllUsed` fails the test even when the code under test
// catches the rejection. It never reaches the network.
//
// Plain errors, no Vitest assertions: `vitest` is an optional peer of this package.

type FakeFetchAnswer =
  | { readonly json: unknown; readonly body?: never; readonly throws?: never }
  | { readonly body?: BodyInit | null; readonly json?: never; readonly throws?: never }
  | { readonly throws: Error; readonly json?: never; readonly body?: never };

/** One scripted answer: what it matches and what it sends back. */
export type FakeFetchRoute = FakeFetchAnswer & {
  /** Matched in any letter case; omitted, any method matches. */
  readonly method?: string;
  /** An exact URL (compared after URL normalisation) or a pattern tested against the full URL. */
  readonly url: string | RegExp;
  /** Answer every matching call instead of the first one only. */
  readonly repeat?: boolean;
  /** Defaults to 200. */
  readonly status?: number;
  readonly headers?: Readonly<Record<string, string>>;
  /** Wait this long before answering; an abort of `init.signal` rejects with the signal's reason. */
  readonly delayMs?: number;
};

/** A call the fake received. */
export interface FakeFetchCall {
  /** Upper case. */
  readonly method: string;
  readonly url: string;
  /** Names in lower case. */
  readonly headers: Readonly<Record<string, string>>;
  /** The request body as text; null when the request has none. */
  readonly body: string | null;
  /** The body parsed as JSON; undefined when there is no body or it is not JSON. */
  readonly json: unknown;
}

export interface FakeFetch {
  readonly fetch: (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
  /** The calls a route answered, in order. */
  readonly calls: readonly FakeFetchCall[];
  /** The calls no route answered, in order. */
  readonly unmatched: readonly FakeFetchCall[];
  /** Throws when a call had no scripted answer or a route never answered. */
  readonly expectAllUsed: () => void;
}

const NULL_BODY_STATUSES = new Set([204, 205, 304]);

interface RouteState {
  readonly route: FakeFetchRoute;
  uses: number;
}

/** Builds a scripted fake `fetch`. Throws when a route cannot be answered as scripted. */
export function fakeFetch(routes: readonly FakeFetchRoute[]): FakeFetch {
  routes.forEach(checkRoute);
  const states: RouteState[] = routes.map((route) => ({ route, uses: 0 }));
  const calls: FakeFetchCall[] = [];
  const unmatched: FakeFetchCall[] = [];

  async function fetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
    throwIfAborted(init?.signal ?? (input instanceof Request ? input.signal : undefined));
    const call = await readCall(input, init);
    const state = states.find((entry) => (entry.route.repeat === true || entry.uses === 0) && matches(entry.route, call));
    if (state === undefined) {
      unmatched.push(call);
      throw new Error(`fakeFetch: no scripted answer for ${call.method} ${call.url}`);
    }
    state.uses += 1;
    calls.push(call);
    const { route } = state;
    if (route.delayMs !== undefined && route.delayMs > 0) await wait(route.delayMs, init?.signal ?? undefined);
    if ("throws" in route && route.throws !== undefined) throw route.throws;
    return buildResponse(route);
  }

  function expectAllUsed(): void {
    const problems: string[] = [];
    if (unmatched.length > 0) {
      const noun = unmatched.length === 1 ? "call had" : "calls had";
      problems.push(`fakeFetch: ${String(unmatched.length)} ${noun} no scripted answer:\n${listCalls(unmatched)}`);
    }
    const unused = states.filter((state) => state.uses === 0).map((state) => `  ${describeRoute(state.route)}`);
    if (unused.length > 0) {
      const noun = unused.length === 1 ? "answer was" : "answers were";
      problems.push(`fakeFetch: ${String(unused.length)} scripted ${noun} not used:\n${unused.join("\n")}`);
    }
    if (problems.length > 0) throw new Error(problems.join("\n"));
  }

  return { fetch, calls, unmatched, expectAllUsed };
}

function checkRoute(route: FakeFetchRoute, index: number): void {
  const name = `fakeFetch: route ${String(index)} (${describeRoute(route)})`;
  const answers = (["json", "body", "throws"] as const).filter((key) => key in route && route[key] !== undefined);
  if (answers.length > 1) throw new Error(`${name} scripts ${answers.join(" and ")}; use one of them`);
  const status = route.status ?? 200;
  if (!Number.isInteger(status) || status < 200 || status > 599) {
    throw new Error(`${name} has status ${String(status)}; use 200 to 599`);
  }
  const hasBody = route.json !== undefined || (route.body !== undefined && route.body !== null);
  if (hasBody && NULL_BODY_STATUSES.has(status)) {
    throw new Error(`${name} scripts a body with status ${String(status)}, which carries none`);
  }
  if (route.delayMs !== undefined && !(route.delayMs >= 0)) {
    throw new Error(`${name} has delayMs ${String(route.delayMs)}; use 0 or more milliseconds`);
  }
}

function describeRoute(route: FakeFetchRoute): string {
  const method = route.method === undefined ? "any" : route.method.toUpperCase();
  return `${method} ${typeof route.url === "string" ? normaliseUrl(route.url) : String(route.url)}`;
}

function listCalls(calls: readonly FakeFetchCall[]): string {
  return calls.map((call) => `  ${call.method} ${call.url}`).join("\n");
}

function matches(route: FakeFetchRoute, call: FakeFetchCall): boolean {
  if (route.method !== undefined && route.method.toUpperCase() !== call.method) return false;
  if (typeof route.url === "string") return normaliseUrl(route.url) === call.url;
  // A pattern with the `g` or `y` flag keeps its position between tests; every match starts from the beginning.
  route.url.lastIndex = 0;
  return route.url.test(call.url);
}

function normaliseUrl(url: string): string {
  return URL.canParse(url) ? new URL(url).href : url;
}

async function readCall(input: string | URL | Request, init: RequestInit | undefined): Promise<FakeFetchCall> {
  const request = input instanceof Request ? input : undefined;
  const url = input instanceof Request ? input.url : normaliseUrl(typeof input === "string" ? input : input.href);
  const method = (init?.method ?? request?.method ?? "GET").toUpperCase();
  const headers: Record<string, string> = {};
  new Headers(init?.headers ?? request?.headers).forEach((value, key) => {
    headers[key] = value;
  });
  const body = await readBody(request, init);
  return { method, url, headers, body, json: parseJson(body) };
}

async function readBody(request: Request | undefined, init: RequestInit | undefined): Promise<string | null> {
  if (init?.body !== undefined && init.body !== null) return new Response(init.body).text();
  if (request?.body !== undefined && request.body !== null) return request.clone().text();
  return null;
}

function parseJson(body: string | null): unknown {
  if (body === null || body === "") return undefined;
  try {
    return JSON.parse(body) as unknown;
  } catch {
    // Not JSON: the raw text stays in `body`.
    return undefined;
  }
}

function buildResponse(route: FakeFetchRoute): Response {
  const headers = new Headers(route.headers);
  const status = route.status ?? 200;
  if (route.json !== undefined) {
    if (!headers.has("content-type")) headers.set("content-type", "application/json");
    return new Response(JSON.stringify(route.json), { status, headers });
  }
  return new Response(NULL_BODY_STATUSES.has(status) ? null : (route.body ?? null), { status, headers });
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  // `throwIfAborted` throws the signal's own reason, as a real `fetch` rejects with it.
  signal?.throwIfAborted();
}

function wait(ms: number, signal: AbortSignal | undefined): Promise<void> {
  return new Promise((resolve, reject) => {
    const onAbort = (): void => {
      clearTimeout(timer);
      reject(signal?.reason as Error);
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
