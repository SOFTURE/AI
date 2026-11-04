/** An in-memory Grafana that answers the calls `applyGrafanaResources` makes, and records them. */
export type FakeGrafanaCall = { method: string; path: string; headers: Record<string, string>; body: unknown };

export type FakeGrafanaState = {
  folders: Set<string>;
  contactPoints: string[];
  /** `<folderUid>/<group>` → the group body Grafana holds. */
  ruleGroups: Map<string, { rules: { uid: string }[] }>;
  dashboards: Set<string>;
  /** Forces a status for `<METHOD> <path>` (path without the query). */
  failures: Map<string, number>;
};

export type FakeGrafana = { state: FakeGrafanaState; calls: FakeGrafanaCall[]; fetch: typeof fetch };

export function createFakeGrafana(initial: Partial<FakeGrafanaState> = {}): FakeGrafana {
  const state: FakeGrafanaState = {
    folders: initial.folders ?? new Set(),
    contactPoints: initial.contactPoints ?? [],
    ruleGroups: initial.ruleGroups ?? new Map<string, { rules: { uid: string }[] }>(),
    dashboards: initial.dashboards ?? new Set(),
    failures: initial.failures ?? new Map<string, number>(),
  };
  const calls: FakeGrafanaCall[] = [];

  const fakeFetch = (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    const method = init?.method ?? "GET";
    const headers = Object.fromEntries(new Headers(init?.headers).entries());
    const body: unknown = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
    calls.push({ method, path: url.pathname + url.search, headers, body });
    return Promise.resolve(answer(state, method, url, body));
  };
  return { state, calls, fetch: fakeFetch };
}

function answer(state: FakeGrafanaState, method: string, url: URL, body: unknown): Response {
  const forced = state.failures.get(`${method} ${url.pathname}`);
  if (forced !== undefined) {
    return new Response(JSON.stringify({ message: "forced failure" }), { status: forced });
  }
  const path = url.pathname;
  const folder = /^\/api\/folders\/([^/]+)$/.exec(path);
  if (method === "GET" && folder !== null) {
    return state.folders.has(decodeURIComponent(folder[1] ?? "")) ? json({ uid: folder[1] }) : notFound();
  }
  if (method === "POST" && path === "/api/folders") {
    state.folders.add((body as { uid: string }).uid);
    return json(body);
  }
  if (method === "GET" && path === "/api/v1/provisioning/contact-points") {
    const name = url.searchParams.get("name");
    return json(state.contactPoints.filter((point) => point === name).map((point) => ({ name: point, type: "email" })));
  }
  const group = /^\/api\/v1\/provisioning\/folder\/([^/]+)\/rule-groups\/([^/]+)$/.exec(path);
  if (group !== null) {
    const key = `${decodeURIComponent(group[1] ?? "")}/${decodeURIComponent(group[2] ?? "")}`;
    if (method === "GET") {
      const existing = state.ruleGroups.get(key);
      return existing === undefined ? notFound() : json(existing);
    }
    if (method === "PUT") {
      state.ruleGroups.set(key, body as { rules: { uid: string }[] });
      return json(body);
    }
  }
  const dashboard = /^\/api\/dashboards\/uid\/([^/]+)$/.exec(path);
  if (method === "GET" && dashboard !== null) {
    return state.dashboards.has(decodeURIComponent(dashboard[1] ?? "")) ? json({ dashboard: {} }) : notFound();
  }
  if (method === "POST" && path === "/api/dashboards/db") {
    state.dashboards.add((body as { dashboard: { uid: string } }).dashboard.uid);
    return json({ status: "success" });
  }
  return new Response("unexpected call", { status: 418 });
}

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}

function notFound(): Response {
  return new Response(JSON.stringify({ message: "not found" }), { status: 404 });
}
