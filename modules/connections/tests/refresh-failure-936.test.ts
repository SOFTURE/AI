// A failed token refresh (#936): the failure value, one warn line and the stored row carry the token endpoint's
// HTTP status and OAuth error code, never its body, error description or a token.
import { getAccessToken, listConnections, replaceRejectedToken } from "@softure-ai/connections/server";
import type { FakeFailure } from "@softure-ai/connections/testing";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { connectFake } from "./connect.js";
import { createTestConnections, readRawRow, type TestConnections } from "./support.js";

const HOUR = 3600_000;

interface Case {
  readonly failure: FakeFailure;
  readonly httpStatus: number | null;
  readonly oauthError: string | null;
}

const CASES: readonly Case[] = [
  { failure: "invalid_request", httpStatus: 400, oauthError: "invalid_request" },
  { failure: "unavailable_without_body", httpStatus: 503, oauthError: null },
  { failure: "unreachable", httpStatus: null, oauthError: null },
];

describe("a failed token refresh", () => {
  let test: TestConnections;
  let warn: MockInstance<typeof console.warn>;

  beforeEach(async () => {
    warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    test = await createTestConnections();
    await connectFake(test);
    test.clock.advance(HOUR);
  });

  afterEach(async () => {
    warn.mockRestore();
    await test.database.close();
  });

  /** Every warn line, with every token and secret the fake provider holds checked to be absent. */
  async function readWarnLines(): Promise<string[]> {
    const lines = warn.mock.calls.map((call) => call.map(String).join(" "));
    const row = await readRawRow(test.database, "fake");
    for (const line of lines) {
      expect(line).not.toContain("rt-secret");
      expect(line).not.toContain("malformed");
      expect(line).not.toContain(String(row.credentials));
      for (const secret of Object.values(test.fake.env)) expect(line).not.toContain(secret);
    }
    return lines;
  }

  it.each(CASES)("$failure: answers, logs and stores the status and the OAuth code", async ({ failure, httpStatus, oauthError }) => {
    test.fake.failNext(failure);
    expect(await getAccessToken(test.ctx, { provider: "fake" })).toEqual({ ok: false, error: "connections.refresh_failed", httpStatus, oauthError });
    const quoted = oauthError === null ? "null" : `"${oauthError}"`;
    expect(await readWarnLines()).toEqual([
      `@softure-ai/connections: token refresh failed provider=fake account_id=default http_status=${httpStatus ?? "null"} oauth_error=${quoted} code=connections.refresh_failed`,
    ]);
    expect(await readRawRow(test.database, "fake")).toMatchObject({
      status: "connected",
      last_error: "connections.refresh_failed",
      last_error_http_status: httpStatus,
      last_error_oauth_error: oauthError,
      lease_id: null,
    });
    const [view] = await listConnections(test.ctx);
    expect(view).toMatchObject({ lastError: "connections.refresh_failed", lastErrorHttpStatus: httpStatus, lastErrorOAuthError: oauthError });
  });

  it("replaceRejectedToken answers the same detail", async () => {
    const first = await getAccessToken(test.ctx, { provider: "fake" });
    if (!first.ok) throw new Error(`test: the first refresh failed with ${first.error}`);
    test.fake.failNext("invalid_request");
    expect(await replaceRejectedToken(test.ctx, { provider: "fake", rejectedToken: first.value.accessToken })).toEqual({
      ok: false,
      error: "connections.refresh_failed",
      httpStatus: 400,
      oauthError: "invalid_request",
    });
  });

  it("logs and stores invalid_grant's answer with reconnect_required", async () => {
    test.fake.revokeGrant();
    expect(await getAccessToken(test.ctx, { provider: "fake" })).toEqual({ ok: false, error: "connections.reconnect_required" });
    expect(await readWarnLines()).toEqual([
      '@softure-ai/connections: token refresh failed provider=fake account_id=default http_status=400 oauth_error="invalid_grant" code=connections.reconnect_required',
    ]);
    expect(await readRawRow(test.database, "fake")).toMatchObject({
      status: "reconnect_required",
      last_error: "connections.reconnect_required",
      last_error_http_status: 400,
      last_error_oauth_error: "invalid_grant",
    });
  });

  it("clears the stored detail on the next successful refresh and on a reconnect", async () => {
    test.fake.failNext("invalid_request");
    await getAccessToken(test.ctx, { provider: "fake" });
    expect((await getAccessToken(test.ctx, { provider: "fake" })).ok).toBe(true);
    expect(await readRawRow(test.database, "fake")).toMatchObject({ last_error: null, last_error_http_status: null, last_error_oauth_error: null });

    test.clock.advance(HOUR);
    test.fake.revokeGrant();
    await getAccessToken(test.ctx, { provider: "fake" });
    await connectFake(test);
    expect(await readRawRow(test.database, "fake")).toMatchObject({ last_error: null, last_error_http_status: null, last_error_oauth_error: null });
  });

  it("refuses a detail without a last error in the database", async () => {
    await expect(
      test.database.client.query("UPDATE connections.accounts SET last_error_http_status = 503 WHERE provider = 'fake'"),
    ).rejects.toThrow(/accounts_error_detail_check/);
  });
});
