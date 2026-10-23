import { describe, expect, expectTypeOf, it } from "vitest";
import { fakeFetch } from "@softure-ai/testing";

const API = "https://api.example.com";

describe("fakeFetch routing", () => {
  it("answers the route whose method and exact URL match", async () => {
    const api = fakeFetch([
      { method: "POST", url: `${API}/v1/items`, json: { created: true }, status: 201 },
      { method: "GET", url: `${API}/v1/items?page=1`, json: { items: [] } },
    ]);
    const response = await api.fetch(`${API}/v1/items?page=1`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ items: [] });
  });

  it("matches the method in any letter case and any method when the route names none", async () => {
    const api = fakeFetch([
      { method: "post", url: `${API}/a`, status: 204 },
      { url: `${API}/b`, status: 202 },
    ]);
    expect((await api.fetch(`${API}/a`, { method: "POST" })).status).toBe(204);
    expect((await api.fetch(`${API}/b`, { method: "DELETE" })).status).toBe(202);
  });

  it("compares normalised URLs, so a bare origin matches its trailing slash", async () => {
    const api = fakeFetch([{ url: API, status: 204 }]);
    expect((await api.fetch(new URL(`${API}/`))).status).toBe(204);
  });

  it("matches a RegExp against the full URL, also with the global flag on every call", async () => {
    const api = fakeFetch([{ method: "POST", url: /\/v1\/items$/g, status: 429, repeat: true }]);
    expect((await api.fetch(`${API}/v1/items`, { method: "POST" })).status).toBe(429);
    expect((await api.fetch(`${API}/v1/items`, { method: "POST" })).status).toBe(429);
  });

  it("answers routes with the same URL in the listed order, each once", async () => {
    const api = fakeFetch([
      { url: `${API}/job`, json: { state: "running" } },
      { url: `${API}/job`, json: { state: "done" } },
    ]);
    expect(await (await api.fetch(`${API}/job`)).json()).toEqual({ state: "running" });
    expect(await (await api.fetch(`${API}/job`)).json()).toEqual({ state: "done" });
    await expect(api.fetch(`${API}/job`)).rejects.toThrow(`fakeFetch: no scripted answer for GET ${API}/job`);
  });

  it("keeps answering a repeated route with a fresh body each time", async () => {
    const api = fakeFetch([{ url: `${API}/health`, json: { ok: true }, repeat: true }]);
    for (let call = 0; call < 3; call += 1) {
      expect(await (await api.fetch(`${API}/health`)).json()).toEqual({ ok: true });
    }
    expect(api.calls).toHaveLength(3);
  });
});

describe("fakeFetch answers", () => {
  it("sends JSON with an application/json content type unless the route sets one", async () => {
    const api = fakeFetch([
      { url: `${API}/a`, json: [1, 2] },
      { url: `${API}/b`, json: { ok: true }, headers: { "Content-Type": "application/problem+json" } },
    ]);
    const plain = await api.fetch(`${API}/a`);
    expect(plain.headers.get("content-type")).toBe("application/json");
    expect(await plain.text()).toBe("[1,2]");
    expect((await api.fetch(`${API}/b`)).headers.get("content-type")).toBe("application/problem+json");
  });

  it("sends a raw body, a status and headers as scripted", async () => {
    const api = fakeFetch([
      {
        url: `${API}/page`,
        body: "not json",
        status: 503,
        headers: { "retry-after": "30", link: `<${API}/page?p=2>; rel="next"` },
      },
    ]);
    const response = await api.fetch(`${API}/page`);
    expect(response.status).toBe(503);
    expect(response.headers.get("Retry-After")).toBe("30");
    expect(response.headers.get("link")).toBe(`<${API}/page?p=2>; rel="next"`);
    expect(await response.text()).toBe("not json");
  });

  it("answers 200 with an empty body when the route scripts no answer", async () => {
    const api = fakeFetch([{ url: `${API}/ping` }]);
    const response = await api.fetch(`${API}/ping`);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("");
  });

  it("rejects with the scripted error", async () => {
    const failure = new TypeError("fetch failed");
    const api = fakeFetch([{ url: `${API}/down`, throws: failure }]);
    await expect(api.fetch(`${API}/down`)).rejects.toBe(failure);
    expect(api.calls).toHaveLength(1);
  });

  it("waits for the delay before answering", async () => {
    const api = fakeFetch([{ url: `${API}/slow`, delayMs: 30, status: 204 }]);
    const started = performance.now();
    expect((await api.fetch(`${API}/slow`)).status).toBe(204);
    expect(performance.now() - started).toBeGreaterThanOrEqual(25);
  });

  it("rejects with the signal's reason when the signal aborts during the delay", async () => {
    const api = fakeFetch([{ url: `${API}/slow`, delayMs: 5_000, status: 204 }]);
    const pending = api.fetch(`${API}/slow`, { signal: AbortSignal.timeout(10) });
    await expect(pending).rejects.toMatchObject({ name: "TimeoutError" });
  });

  it("takes the signal of a Request input when init has none", async () => {
    const api = fakeFetch([{ url: `${API}/slow`, delayMs: 5_000 }]);
    const request = new Request(`${API}/slow`, { signal: AbortSignal.timeout(10) });
    await expect(api.fetch(request)).rejects.toMatchObject({ name: "TimeoutError" });
  });

  it("rejects at once when the signal is already aborted", async () => {
    const controller = new AbortController();
    const reason = new Error("cancelled");
    controller.abort(reason);
    const api = fakeFetch([{ url: `${API}/a`, status: 204 }]);
    await expect(api.fetch(`${API}/a`, { signal: controller.signal })).rejects.toBe(reason);
  });
});

describe("fakeFetch records", () => {
  it("records method, URL, lower-case headers, the body and its parsed JSON", async () => {
    const api = fakeFetch([{ method: "POST", url: `${API}/v1/items` }]);
    await api.fetch(`${API}/v1/items`, {
      method: "post",
      headers: { Authorization: "Bearer t", "Content-Type": "application/json" },
      body: JSON.stringify({ name: "a" }),
    });
    expect(api.calls).toEqual([
      {
        method: "POST",
        url: `${API}/v1/items`,
        headers: { authorization: "Bearer t", "content-type": "application/json" },
        body: '{"name":"a"}',
        json: { name: "a" },
      },
    ]);
  });

  it("records a GET without a body as null body and undefined JSON", async () => {
    const api = fakeFetch([{ url: `${API}/a` }]);
    await api.fetch(`${API}/a`);
    expect(api.calls[0]).toEqual({ method: "GET", url: `${API}/a`, headers: {}, body: null, json: undefined });
  });

  it("keeps a body that is not JSON as text with undefined JSON", async () => {
    const api = fakeFetch([{ method: "POST", url: `${API}/form` }]);
    await api.fetch(`${API}/form`, { method: "POST", body: new URLSearchParams({ a: "1", b: "2" }) });
    expect(api.calls[0]).toMatchObject({ body: "a=1&b=2", json: undefined });
  });

  it("reads method, headers and body from a Request input, init overriding the method", async () => {
    const api = fakeFetch([{ method: "PUT", url: `${API}/a` }]);
    const request = new Request(`${API}/a`, { method: "POST", headers: { "X-Key": "k" }, body: '{"v":1}' });
    await api.fetch(request, { method: "PUT" });
    expect(api.calls[0]).toEqual({ method: "PUT", url: `${API}/a`, headers: { "x-key": "k", "content-type": "text/plain;charset=UTF-8" }, body: '{"v":1}', json: { v: 1 } });
  });
});

describe("fakeFetch checks", () => {
  it("rejects an unmatched call with its method and URL and makes expectAllUsed fail", async () => {
    const api = fakeFetch([{ url: `${API}/a` }]);
    await api.fetch(`${API}/a`);
    await expect(api.fetch(`${API}/b`, { method: "DELETE" })).rejects.toThrow(
      `fakeFetch: no scripted answer for DELETE ${API}/b`,
    );
    expect(api.unmatched).toEqual([{ method: "DELETE", url: `${API}/b`, headers: {}, body: null, json: undefined }]);
    expect(() => api.expectAllUsed()).toThrow(`fakeFetch: 1 call had no scripted answer:\n  DELETE ${API}/b`);
  });

  it("does not record an unmatched call as answered", async () => {
    const api = fakeFetch([]);
    await expect(api.fetch(`${API}/x`)).rejects.toThrow(`GET ${API}/x`);
    expect(api.calls).toEqual([]);
  });

  it("lists every route that never answered", async () => {
    const api = fakeFetch([
      { method: "GET", url: `${API}/a` },
      { method: "POST", url: /\/b$/ },
      { url: `${API}/c`, repeat: true },
    ]);
    await api.fetch(`${API}/a`);
    expect(() => api.expectAllUsed()).toThrow(`fakeFetch: 2 scripted answers were not used:\n  POST /\\/b$/\n  any ${API}/c`);
  });

  it("passes when every scripted answer was used and nothing was unmatched", async () => {
    const api = fakeFetch([
      { url: `${API}/a` },
      { url: `${API}/b`, repeat: true },
    ]);
    await api.fetch(`${API}/a`);
    await api.fetch(`${API}/b`);
    expect(() => api.expectAllUsed()).not.toThrow();
  });

  it("refuses a body on a status that cannot carry one when the fake is built", () => {
    expect(() => fakeFetch([{ url: `${API}/a`, status: 204, json: {} }])).toThrow(
      `fakeFetch: route 0 (any ${API}/a) scripts a body with status 204, which carries none`,
    );
  });

  it("refuses a route that scripts two answers when the fake is built", () => {
    // The route type allows one answer; a plain JavaScript caller can still pass two.
    const route = { url: `${API}/a`, json: {}, throws: new Error("x") } as unknown as Parameters<typeof fakeFetch>[0][number];
    expect(() => fakeFetch([route])).toThrow(`fakeFetch: route 0 (any ${API}/a) scripts json and throws; use one of them`);
  });

  it("refuses a status outside 200 to 599 when the fake is built", () => {
    expect(() => fakeFetch([{ url: `${API}/a`, status: 99 }])).toThrow(
      `fakeFetch: route 0 (any ${API}/a) has status 99; use 200 to 599`,
    );
  });

  it("refuses a negative delay when the fake is built", () => {
    expect(() => fakeFetch([{ url: `${API}/a`, delayMs: -1 }])).toThrow(
      `fakeFetch: route 0 (any ${API}/a) has delayMs -1; use 0 or more milliseconds`,
    );
  });

  it("returns a fetch that fits the global fetch and core's FetchFunction", () => {
    type FetchFunction = (input: string | URL, init: RequestInit) => Promise<Response>;
    const api = fakeFetch([]);
    expectTypeOf(api.fetch).toExtend<typeof fetch>();
    expectTypeOf(api.fetch).toExtend<FetchFunction>();
  });
});
