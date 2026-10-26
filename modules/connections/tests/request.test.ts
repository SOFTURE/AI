// requestWithConnection: the header for every credential kind, one refresh and one retry on a 401 with OAuth, the
// rejection only after the second 401 (or the first for a key), and every other answer passed through unchanged.
import type { ReconnectRequiredEvent } from "@softure-ai/connections";
import { requestWithConnection, saveCredential, type ConnectionRequestFailure } from "@softure-ai/connections/server";
import type { FetchFunction, HttpJsonFailure } from "@softure-ai/core";
import { afterEach, describe, expect, expectTypeOf, it } from "vitest";
import { z } from "zod";
import { connectFake } from "./connect.js";
import { ADMIN, createTestConnections, readRawRow, type CreateTestConnectionsOptions, type TestConnections } from "./support.js";

const API = "https://api.example.test/items";

interface Recorded {
  readonly authorization: string | null;
  readonly method: string;
  readonly body: string | null;
  readonly headers: Headers;
}

/** A fetch that records each call and answers the given responses in order (the last one repeats). */
function createRecordingFetch(...answers: (() => Response)[]): { fetch: FetchFunction; calls: Recorded[] } {
  const calls: Recorded[] = [];
  const fetch: FetchFunction = (_input, init) => {
    const headers = new Headers(init.headers);
    calls.push({ authorization: headers.get("authorization"), method: init.method ?? "GET", body: typeof init.body === "string" ? init.body : null, headers });
    const answer = answers[Math.min(calls.length - 1, answers.length - 1)];
    if (answer === undefined) throw new Error("test: no answer");
    return Promise.resolve(answer());
  };
  return { fetch, calls };
}

const status = (code: number, body: unknown = { error: "x" }) => () => new Response(JSON.stringify(body), { status: code, headers: { "x-request-id": "req-1" } });

describe("requestWithConnection", () => {
  let test: TestConnections;
  let events: ReconnectRequiredEvent[];

  async function setUp(options: CreateTestConnectionsOptions = {}): Promise<void> {
    events = [];
    test = await createTestConnections({ ...options, connections: { onReconnectRequired: (event) => void events.push(event), ...options.connections } });
  }

  afterEach(async () => {
    await test.database.close();
  });

  describe("with OAuth", () => {
    it("sends the access token and answers the body", async () => {
      await setUp();
      await connectFake(test);
      expect(await requestWithConnection(test.ctx, { provider: "fake" }, { url: test.fake.apiUrl, fetch: test.fake.fetch })).toEqual({ ok: true, value: { ok: true } });
      expect(test.fake.calls.api).toBe(1);
      expect(test.fake.calls.refresh).toBe(0);
    });

    it("refreshes once and retries once when the provider refuses the token early, keeping the connection", async () => {
      await setUp();
      await connectFake(test);
      test.fake.rejectAccessTokens();
      expect(await requestWithConnection(test.ctx, { provider: "fake" }, { url: test.fake.apiUrl, fetch: test.fake.fetch, schema: z.object({ ok: z.literal(true) }) })).toEqual({
        ok: true,
        value: { ok: true },
      });
      expect(test.fake.calls.api).toBe(2);
      expect(test.fake.calls.refresh).toBe(1);
      expect(events).toEqual([]);
      expect(await readRawRow(test.database, "fake")).toMatchObject({ status: "connected", lease_id: null });
    });

    it("reports the credential rejected after a second 401 and calls the API no more", async () => {
      await setUp();
      await connectFake(test);
      const api = createRecordingFetch(status(401));
      expect(await requestWithConnection(test.ctx, { provider: "fake" }, { url: API, fetch: api.fetch })).toEqual({ ok: false, error: "connections.reconnect_required" });
      expect(api.calls).toHaveLength(2);
      expect(api.calls[0]?.authorization).not.toBe(api.calls[1]?.authorization);
      expect(test.fake.calls.refresh).toBe(1);
      expect(events.map((event) => event.reason)).toEqual(["rejected"]);
      expect(await requestWithConnection(test.ctx, { provider: "fake" }, { url: API, fetch: api.fetch })).toEqual({ ok: false, error: "connections.reconnect_required" });
      expect(api.calls).toHaveLength(2);
    });

    it("answers reconnect_required when the refresh meets invalid_grant, without a retry", async () => {
      await setUp();
      await connectFake(test);
      test.fake.rejectAccessTokens();
      test.fake.revokeGrant();
      expect(await requestWithConnection(test.ctx, { provider: "fake" }, { url: test.fake.apiUrl, fetch: test.fake.fetch })).toEqual({ ok: false, error: "connections.reconnect_required" });
      expect(test.fake.calls.api).toBe(1);
      expect(events.map((event) => event.reason)).toEqual(["invalid_grant"]);
    });

    it("answers the retryable refresh_failed when the refresh fails, keeping the connection", async () => {
      await setUp();
      await connectFake(test);
      test.fake.rejectAccessTokens();
      test.fake.failNext("unavailable");
      expect(await requestWithConnection(test.ctx, { provider: "fake" }, { url: test.fake.apiUrl, fetch: test.fake.fetch })).toEqual({ ok: false, error: "connections.refresh_failed" });
      expect(await readRawRow(test.database, "fake")).toMatchObject({ status: "connected" });
      expect(events).toEqual([]);
      // The next call refreshes and succeeds.
      expect((await requestWithConnection(test.ctx, { provider: "fake" }, { url: test.fake.apiUrl, fetch: test.fake.fetch })).ok).toBe(true);
    });

    it("reports a 401 at once when there is no refresh token to try another token with", async () => {
      await setUp({ fake: { issuesRefreshToken: false } });
      await connectFake(test);
      test.fake.rejectAccessTokens();
      expect(await requestWithConnection(test.ctx, { provider: "fake" }, { url: test.fake.apiUrl, fetch: test.fake.fetch })).toEqual({ ok: false, error: "connections.reconnect_required" });
      expect(test.fake.calls.api).toBe(1);
      expect(test.fake.calls.refresh).toBe(0);
      expect(events.map((event) => event.reason)).toEqual(["rejected"]);
    });

    it("reports a refused token that never expires as rejected, not expired", async () => {
      await setUp({ fake: { issuesRefreshToken: false, accessTokenTtlSeconds: null } });
      await connectFake(test);
      test.fake.rejectAccessTokens();
      expect(await requestWithConnection(test.ctx, { provider: "fake" }, { url: test.fake.apiUrl, fetch: test.fake.fetch })).toEqual({ ok: false, error: "connections.reconnect_required" });
      expect(events.map((event) => event.reason)).toEqual(["rejected"]);
    });

    it("refreshes once for overlapping calls refused with the same token", async () => {
      await setUp();
      await connectFake(test);
      test.fake.rejectAccessTokens();
      test.fake.setDelay(20);
      const results = await Promise.all([1, 2, 3].map(() => requestWithConnection(test.ctx, { provider: "fake" }, { url: test.fake.apiUrl, fetch: test.fake.fetch })));
      expect(results).toEqual([1, 2, 3].map(() => ({ ok: true, value: { ok: true } })));
      expect(test.fake.calls.refresh).toBe(1);
    });

    it("answers a credential failure before the call as its code", async () => {
      await setUp();
      const api = createRecordingFetch(status(200, {}));
      expect(await requestWithConnection(test.ctx, { provider: "fake" }, { url: API, fetch: api.fetch })).toEqual({ ok: false, error: "connections.not_connected" });
      expect(await requestWithConnection(test.ctx, { provider: "nope" }, { url: API, fetch: api.fetch })).toEqual({ ok: false, error: "connections.unknown_provider" });
      expect(await requestWithConnection({ ...test.ctx, env: {} }, { provider: "raindrop" }, { url: API, fetch: api.fetch })).toEqual({ ok: false, error: "connections.key_missing" });
      expect(api.calls).toEqual([]);
    });
  });

  describe("with an API key or Basic credential", () => {
    it("sends the key as a bearer, replacing the caller's own authorization header, and forwards the options", async () => {
      await setUp();
      await saveCredential(test.ctx, { provider: "raindrop", credential: { kind: "api_key", apiKey: "rd-key" }, actorId: ADMIN });
      const api = createRecordingFetch(() => new Response(JSON.stringify({ id: 7 }), { status: 201, headers: { "x-request-id": "req-9" } }));
      const result = await requestWithConnection(
        test.ctx,
        { provider: "raindrop" },
        { url: API, fetch: api.fetch, method: "POST", body: { name: "a" }, headers: { Authorization: "Bearer stale", "x-trace": "t1" }, schema: z.object({ id: z.number() }), readHeaders: ["x-request-id"] },
      );
      expect(result).toEqual({ ok: true, value: { body: { id: 7 }, headers: { "x-request-id": "req-9" } } });
      // The overloads of requestJson carry through: a write's body is the schema's output or undefined.
      if (result.ok) expectTypeOf(result.value).toEqualTypeOf<{ readonly body: { id: number } | undefined; readonly headers: Readonly<Record<"x-request-id", string | null>> }>();
      else expectTypeOf(result.error).toEqualTypeOf<HttpJsonFailure["error"] | ConnectionRequestFailure["error"]>();
      expect(api.calls).toHaveLength(1);
      expect(api.calls[0]).toMatchObject({ authorization: "Bearer rd-key", method: "POST", body: '{"name":"a"}' });
      expect(api.calls[0]?.headers.get("x-trace")).toBe("t1");
    });

    it("takes the caller's headers as a Headers object or a list of pairs", async () => {
      await setUp();
      await saveCredential(test.ctx, { provider: "raindrop", credential: { kind: "api_key", apiKey: "rd-key" }, actorId: ADMIN });
      const api = createRecordingFetch(status(200, {}));
      await requestWithConnection(test.ctx, { provider: "raindrop" }, { url: API, fetch: api.fetch, headers: new Headers({ authorization: "x", "x-a": "1" }) });
      await requestWithConnection(test.ctx, { provider: "raindrop" }, { url: API, fetch: api.fetch, headers: [["x-b", "2"]] });
      expect(api.calls.map((call) => [call.authorization, call.headers.get("x-a"), call.headers.get("x-b")])).toEqual([
        ["Bearer rd-key", "1", null],
        ["Bearer rd-key", null, "2"],
      ]);
    });

    it("sends Basic for a Basic account and reports a 401 at once, without a retry", async () => {
      await setUp();
      await saveCredential(test.ctx, { provider: "toggl", accountId: "work", credential: { kind: "basic", username: "ada", password: "pw" }, actorId: ADMIN });
      const api = createRecordingFetch(status(401));
      expect(await requestWithConnection(test.ctx, { provider: "toggl", accountId: "work" }, { url: API, fetch: api.fetch })).toEqual({ ok: false, error: "connections.reconnect_required" });
      expect(api.calls.map((call) => call.authorization)).toEqual([`Basic ${Buffer.from("ada:pw").toString("base64")}`]);
      expect(events).toEqual([{ provider: "toggl", accountId: "work", kind: "basic", reason: "rejected", at: test.clock.now() }]);
    });

    it.each([
      [403, { ok: false, error: "core.http_refused", status: 403 }],
      [404, { ok: false, error: "core.http_unexpected_answer", status: 404 }],
      [503, { ok: false, error: "core.http_unavailable", status: 503, retryAfterSeconds: null }],
    ])("passes a %i through unchanged and reports nothing", async (code, expected) => {
      await setUp();
      await saveCredential(test.ctx, { provider: "raindrop", credential: { kind: "api_key", apiKey: "rd-key" }, actorId: ADMIN });
      const api = createRecordingFetch(status(code));
      expect(await requestWithConnection(test.ctx, { provider: "raindrop" }, { url: API, fetch: api.fetch })).toEqual(expected);
      expect(api.calls).toHaveLength(1);
      expect(events).toEqual([]);
      expect(await readRawRow(test.database, "raindrop")).toMatchObject({ status: "connected" });
    });
  });

  describe("with an API key provider's own header", () => {
    const providers = (): CreateTestConnectionsOptions["providers"] => () => [
      { kind: "api_key", id: "vendor", header: { name: "X-Vendor-ApiKey" } },
      { kind: "api_key", id: "other", header: { name: "Authorization", scheme: "Token" } },
    ];

    it("sends the bare key in that header, replacing the caller's header of that name and keeping its authorization header", async () => {
      await setUp({ providers: providers() });
      await saveCredential(test.ctx, { provider: "vendor", credential: { kind: "api_key", apiKey: "v-key" }, actorId: ADMIN });
      const api = createRecordingFetch(status(200, { ok: true }));
      const result = await requestWithConnection(test.ctx, { provider: "vendor" }, { url: API, fetch: api.fetch, headers: { "x-vendor-apikey": "stale", authorization: "Bearer app" } });
      expect(result).toEqual({ ok: true, value: { ok: true } });
      expect(api.calls).toHaveLength(1);
      expect(api.calls[0]?.headers.get("x-vendor-apikey")).toBe("v-key");
      expect(api.calls[0]?.authorization).toBe("Bearer app");
    });

    it("sends the key with the provider's scheme in Authorization", async () => {
      await setUp({ providers: providers() });
      await saveCredential(test.ctx, { provider: "other", credential: { kind: "api_key", apiKey: "o-key" }, actorId: ADMIN });
      const api = createRecordingFetch(status(200, {}));
      await requestWithConnection(test.ctx, { provider: "other" }, { url: API, fetch: api.fetch, headers: [["AUTHORIZATION", "x"]] });
      expect(api.calls.map((call) => call.authorization)).toEqual(["Token o-key"]);
    });

    it("still reports a 401 at once, without a retry", async () => {
      await setUp({ providers: providers() });
      await saveCredential(test.ctx, { provider: "vendor", credential: { kind: "api_key", apiKey: "v-key" }, actorId: ADMIN });
      const api = createRecordingFetch(status(401));
      expect(await requestWithConnection(test.ctx, { provider: "vendor" }, { url: API, fetch: api.fetch })).toEqual({ ok: false, error: "connections.reconnect_required" });
      expect(api.calls).toHaveLength(1);
      expect(events).toEqual([{ provider: "vendor", accountId: "default", kind: "api_key", reason: "rejected", at: test.clock.now() }]);
    });
  });
});
