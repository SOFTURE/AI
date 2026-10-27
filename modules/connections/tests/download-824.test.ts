// downloadWithConnection: a file read with the stored credential under requestWithConnection's rules (the header for
// every credential kind, one refresh and one retry on an OAuth 401, the rejection after a 401 that stands), answering
// the bytes and the content type, and every other answer passed through unchanged.
import type { ReconnectRequiredEvent } from "@softure-ai/connections";
import { downloadWithConnection, saveCredential } from "@softure-ai/connections/server";
import type { FetchFunction } from "@softure-ai/core";
import { afterEach, describe, expect, it } from "vitest";
import { connectFake } from "./connect.js";
import { ADMIN, createTestConnections, readRawRow, type CreateTestConnectionsOptions, type TestConnections } from "./support.js";

const API = "https://api.example.test/invoices/7/pdf";
const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]);

interface Recorded {
  readonly headers: Headers;
  readonly method: string;
  readonly body: string | null;
}

/** A fetch that records each call and answers the given responses in order (the last one repeats). */
function createRecordingFetch(...answers: (() => Response)[]): { fetch: FetchFunction; calls: Recorded[] } {
  const calls: Recorded[] = [];
  const fetch: FetchFunction = (_input, init) => {
    calls.push({ headers: new Headers(init.headers), method: init.method ?? "GET", body: typeof init.body === "string" ? init.body : null });
    const answer = answers[Math.min(calls.length - 1, answers.length - 1)];
    if (answer === undefined) throw new Error("test: no answer");
    return Promise.resolve(answer());
  };
  return { fetch, calls };
}

const pdf = () => new Response(PDF, { headers: { "content-type": "application/pdf" } });
const status = (code: number) => () => new Response(null, { status: code });

describe("downloadWithConnection", () => {
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
    it("sends the access token and answers the bytes with their content type", async () => {
      await setUp();
      await connectFake(test);
      const result = await downloadWithConnection(test.ctx, { provider: "fake" }, { url: test.fake.apiUrl, fetch: test.fake.fetch });
      expect(result.ok && new TextDecoder().decode(result.value.bytes)).toBe('{"ok":true}');
      expect(result.ok && result.value.contentType).toMatch(/^application\/json/);
      expect(test.fake.calls.api).toBe(1);
    });

    it("refreshes once and retries once when the provider refuses the token early", async () => {
      await setUp();
      await connectFake(test);
      test.fake.rejectAccessTokens();
      const result = await downloadWithConnection(test.ctx, { provider: "fake" }, { url: test.fake.apiUrl, fetch: test.fake.fetch });
      expect(result.ok).toBe(true);
      expect(test.fake.calls.api).toBe(2);
      expect(test.fake.calls.refresh).toBe(1);
      expect(events).toEqual([]);
      expect(await readRawRow(test.database, "fake")).toMatchObject({ status: "connected" });
    });

    it("reports the credential rejected after a second 401", async () => {
      await setUp();
      await connectFake(test);
      const api = createRecordingFetch(status(401));
      expect(await downloadWithConnection(test.ctx, { provider: "fake" }, { url: API, fetch: api.fetch })).toEqual({ ok: false, error: "connections.reconnect_required" });
      expect(api.calls).toHaveLength(2);
      expect(api.calls[0]?.headers.get("authorization")).not.toBe(api.calls[1]?.headers.get("authorization"));
      expect(events.map((event) => event.reason)).toEqual(["rejected"]);
    });

    it("answers a credential failure before the call as its code", async () => {
      await setUp();
      const api = createRecordingFetch(pdf);
      expect(await downloadWithConnection(test.ctx, { provider: "fake" }, { url: API, fetch: api.fetch })).toEqual({ ok: false, error: "connections.not_connected" });
      expect(await downloadWithConnection(test.ctx, { provider: "nope" }, { url: API, fetch: api.fetch })).toEqual({ ok: false, error: "connections.unknown_provider" });
      expect(api.calls).toEqual([]);
    });
  });

  describe("with an API key or Basic credential", () => {
    it("sends the key, replacing the caller's authorization header, and forwards method, body and accept", async () => {
      await setUp();
      await saveCredential(test.ctx, { provider: "raindrop", credential: { kind: "api_key", apiKey: "rd-key" }, actorId: ADMIN });
      const api = createRecordingFetch(pdf);
      const result = await downloadWithConnection(
        test.ctx,
        { provider: "raindrop" },
        { url: API, fetch: api.fetch, method: "POST", body: { id: 7 }, accept: "application/pdf", headers: { Authorization: "Bearer stale", "x-trace": "t1" } },
      );
      expect(result).toEqual({ ok: true, value: { bytes: PDF, contentType: "application/pdf" } });
      expect(api.calls).toHaveLength(1);
      expect(api.calls[0]).toMatchObject({ method: "POST", body: '{"id":7}' });
      expect(api.calls[0]?.headers.get("authorization")).toBe("Bearer rd-key");
      expect(api.calls[0]?.headers.get("accept")).toBe("application/pdf");
      expect(api.calls[0]?.headers.get("x-trace")).toBe("t1");
    });

    it("sends the bare key in an API key provider's own header", async () => {
      await setUp({ providers: () => [{ kind: "api_key", id: "vendor", header: { name: "X-Vendor-ApiKey" } }] });
      await saveCredential(test.ctx, { provider: "vendor", credential: { kind: "api_key", apiKey: "v-key" }, actorId: ADMIN });
      const api = createRecordingFetch(pdf);
      expect((await downloadWithConnection(test.ctx, { provider: "vendor" }, { url: API, fetch: api.fetch })).ok).toBe(true);
      expect(api.calls[0]?.headers.get("x-vendor-apikey")).toBe("v-key");
    });

    it("sends Basic for a Basic account and reports a 401 at once, without a retry", async () => {
      await setUp();
      await saveCredential(test.ctx, { provider: "toggl", accountId: "work", credential: { kind: "basic", username: "ada", password: "pw" }, actorId: ADMIN });
      const api = createRecordingFetch(status(401));
      expect(await downloadWithConnection(test.ctx, { provider: "toggl", accountId: "work" }, { url: API, fetch: api.fetch })).toEqual({ ok: false, error: "connections.reconnect_required" });
      expect(api.calls.map((call) => call.headers.get("authorization"))).toEqual([`Basic ${Buffer.from("ada:pw").toString("base64")}`]);
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
      expect(await downloadWithConnection(test.ctx, { provider: "raindrop" }, { url: API, fetch: api.fetch })).toEqual(expected);
      expect(api.calls).toHaveLength(1);
      expect(events).toEqual([]);
    });

    it("passes a body above maxBytes through as too large", async () => {
      await setUp();
      await saveCredential(test.ctx, { provider: "raindrop", credential: { kind: "api_key", apiKey: "rd-key" }, actorId: ADMIN });
      const api = createRecordingFetch(pdf);
      expect(await downloadWithConnection(test.ctx, { provider: "raindrop" }, { url: API, fetch: api.fetch, maxBytes: 4 })).toEqual({ ok: false, error: "core.http_too_large", status: 200 });
      expect(events).toEqual([]);
    });
  });
});
