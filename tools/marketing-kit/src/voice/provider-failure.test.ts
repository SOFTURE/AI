import { describe, expect, it } from "vitest";

import { describeProviderFailure, getConnectionFailure, getLocalRefusal, getProviderFailure, getProviderFailureKind, PROVIDER_MESSAGE_LENGTH, readProviderErrorBody } from "./provider-failure.js";

describe("provider failures (issue #1141)", () => {
  it("reads the status, the provider's code and message and the request id header of a refusal", () => {
    const response = new Response(null, { status: 400, headers: { "request-id": "req_123" } });
    const failure = getProviderFailure(response, JSON.stringify({ detail: { status: "audio_too_short", message: "The audio is too short." } }));
    expect(failure).toEqual({ kind: "refused", status: 400, code: "audio_too_short", message: "The audio is too short.", requestId: "req_123", isRetryable: false });
  });

  it("takes the code field, the body's request id and the x-request-id header", () => {
    expect(readProviderErrorBody(JSON.stringify({ detail: { code: "invalid_format", message: "bad", request_id: "req_body" } }))).toEqual({ code: "invalid_format", message: "bad", requestId: "req_body" });
    expect(getProviderFailure(new Response(null, { status: 422, headers: { "x-request-id": "req_x" } }), "{}").requestId).toBe("req_x");
  });

  it("keeps a text body or a text detail as the message, truncated, with no code", () => {
    expect(readProviderErrorBody("quota exceeded")).toEqual({ code: null, message: "quota exceeded", requestId: null });
    expect(readProviderErrorBody(JSON.stringify({ detail: "Not found" }))).toEqual({ code: null, message: "Not found", requestId: null });
    expect(readProviderErrorBody("x".repeat(1000)).message).toHaveLength(PROVIDER_MESSAGE_LENGTH);
    expect(readProviderErrorBody("")).toEqual({ code: null, message: null, requestId: null });
  });

  it("marks 5xx, 408 and 429 retryable and every other 4xx a refusal", () => {
    expect([400, 401, 404, 409, 422].map(getProviderFailureKind)).toEqual(["refused", "refused", "refused", "refused", "refused"]);
    expect([408, 429, 500, 503].map(getProviderFailureKind)).toEqual(["timeout", "rate_limited", "unavailable", "unavailable"]);
    expect([408, 429, 503].map((status) => getProviderFailure(new Response(null, { status }), "").isRetryable)).toEqual([true, true, true]);
  });

  it("answers a timeout or a failed connection as retryable, without a status", () => {
    expect(getConnectionFailure(new DOMException("timed out", "TimeoutError"))).toEqual({ kind: "timeout", status: null, code: null, message: null, requestId: null, isRetryable: true });
    expect(getConnectionFailure(new TypeError("fetch failed"))).toEqual({ kind: "connection", status: null, code: null, message: null, requestId: null, isRetryable: true });
    expect(getLocalRefusal("missing_api_key")).toEqual({ kind: "refused", status: null, code: "missing_api_key", message: null, requestId: null, isRetryable: false });
  });

  it("describes a failure in one line", () => {
    expect(describeProviderFailure({ kind: "refused", status: 400, code: "audio_too_short", message: "Too short.", requestId: "req_1", isRetryable: false })).toBe("refused, 400, audio_too_short, request req_1: Too short.");
    expect(describeProviderFailure(getConnectionFailure(new Error("down")))).toBe("connection");
  });
});
