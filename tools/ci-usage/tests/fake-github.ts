import type { FetchLike } from "../src/github.js";

export interface FakeRoute {
  /** Matched against `pathname?search` of the request. */
  match: (url: URL) => boolean;
  status?: number;
  body: unknown;
  headers?: Record<string, string>;
}

export interface FakeGithub {
  fetch: FetchLike;
  requests: { method: string; url: URL; body?: unknown }[];
}

/** A fetch that answers from routes, first match wins; an unmatched request is a test bug and answers 599. */
export function createFakeGithub(routes: FakeRoute[], remaining: () => number = () => 4000): FakeGithub {
  const requests: FakeGithub["requests"] = [];
  const fetch: FetchLike = (address, init) => {
    const url = new URL(address);
    const body = (init as { body?: string }).body;
    requests.push({ method: init.method, url, ...(body === undefined ? {} : { body: JSON.parse(body) as unknown }) });
    const route = routes.find((candidate) => candidate.match(url));
    const headers = new Headers({ "content-type": "application/json", "x-ratelimit-remaining": String(remaining()), ...(route?.headers ?? {}) });
    if (!route) return Promise.resolve(new Response(JSON.stringify({ message: `no route for ${url.pathname}${url.search}` }), { status: 599, headers }));
    return Promise.resolve(new Response(JSON.stringify(route.body), { status: route.status ?? 200, headers }));
  };
  return { fetch, requests };
}

export function makeRun(id: number, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { id, name: "ci", path: ".github/workflows/ci.yml", status: "completed", conclusion: "success", run_attempt: 1, updated_at: "2026-11-17T10:10:00Z", ...overrides };
}

export function makeApiJob(id: number, runId: number, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id,
    run_id: runId,
    run_attempt: 1,
    name: "test",
    workflow_name: "ci",
    started_at: "2026-11-17T10:00:00Z",
    completed_at: "2026-11-17T10:02:30Z",
    labels: ["ubuntu-latest"],
    runner_group_name: "GitHub Actions",
    html_url: `https://github.com/acme/app/actions/runs/${String(runId)}/job/${String(id)}`,
    ...overrides,
  };
}
