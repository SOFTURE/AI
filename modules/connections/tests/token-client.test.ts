// The token client keeps every failure to a code: a URL, a key or a provider's error text never leaves it.
import { getAccessToken } from "@softure-ai/connections/server";
import type { FetchFunction } from "@softure-ai/core";
import { afterEach, describe, expect, it } from "vitest";
import { connectFake } from "./connect.js";
import { createTestConnections, type TestConnections } from "./support.js";

describe("the token client", () => {
  let test: TestConnections;

  afterEach(async () => {
    await test.database.close();
  });

  it("asks for JSON with a form body, never follows a redirect and times out", async () => {
    test = await createTestConnections();
    await connectFake(test);
    test.clock.advance(3600_000);
    const seen: RequestInit[] = [];
    const recording: FetchFunction = (input, init) => {
      seen.push(init);
      return test.fake.fetch(input, init);
    };
    const config = { ...test.config, modules: test.config.modules.map((module) => (module.id === "connections" ? { ...module, options: { ...(module.options as object), fetch: recording } } : module)) };
    expect((await getAccessToken({ ...test.ctx, config }, { provider: "fake" })).ok).toBe(true);
    const [init] = seen;
    const headers = new Headers(init?.headers);
    expect(init?.method).toBe("POST");
    expect(init?.redirect).toBe("manual");
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    expect(headers.get("accept")).toBe("application/json");
    expect(headers.get("content-type")).toBe("application/x-www-form-urlencoded");
  });

  it("answers a provider's error text, a thrown error with the URL and a hung request as codes", async () => {
    test = await createTestConnections({ connections: { httpTimeoutMs: 100, refreshLeaseSeconds: 5 } });
    await connectFake(test);
    test.clock.advance(3600_000);
    test.fake.failNext("unreachable");
    const failed = await getAccessToken(test.ctx, { provider: "fake" });
    expect(failed).toEqual({ ok: false, error: "connections.refresh_failed" });
    expect(JSON.stringify(failed)).not.toContain("fake-oauth.test");

    test.fake.setDelay(500);
    const hung: FetchFunction = (input, init) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(new Error(`aborted ${String(input)}`)));
      });
    const config = { ...test.config, modules: test.config.modules.map((module) => (module.id === "connections" ? { ...module, options: { ...(module.options as object), fetch: hung } } : module)) };
    expect(await getAccessToken({ ...test.ctx, config }, { provider: "fake" })).toEqual({ ok: false, error: "connections.refresh_failed" });
  });
});
