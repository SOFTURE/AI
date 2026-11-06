import { describe, expect, it } from "vitest";
import { err, getProviderFootageFailure, isRetryableFootageFailure, ok } from "./failure.js";

describe("footage failures", () => {
  it("builds a transient process failure unless a kind is named", () => {
    expect(err("hyperframes render ended with code 137 (signal -).")).toEqual({ ok: false, error: "hyperframes render ended with code 137 (signal -).", failure: { kind: "process" } });
    expect(err("bad EDL", { kind: "input" })).toEqual({ ok: false, error: "bad EDL", failure: { kind: "input" } });
    expect(ok(3)).toEqual({ ok: true, value: 3 });
  });

  it("offers a retry for a process failure only", () => {
    expect(isRetryableFootageFailure({ kind: "process" })).toBe(true);
    expect(isRetryableFootageFailure({ kind: "input" })).toBe(false);
    expect(isRetryableFootageFailure({ kind: "publishable", problems: ["no fast start"] })).toBe(false);
    expect(isRetryableFootageFailure({ kind: "loudness", loudness: { integrated: -9.2, truePeak: -0.4 } })).toBe(false);
    expect(isRetryableFootageFailure({ kind: "loudness", loudness: null })).toBe(false);
  });

  it("carries a provider's failure and retries it only when the provider says so (issue #1141)", () => {
    const refusal = { kind: "refused", status: 400, code: "audio_too_short", message: null, requestId: "req_1", isRetryable: false } as const;
    expect(getProviderFootageFailure(refusal)).toEqual({ kind: "provider", provider: refusal });
    expect(getProviderFootageFailure(undefined)).toEqual({ kind: "process" });
    expect(isRetryableFootageFailure({ kind: "provider", provider: refusal })).toBe(false);
    expect(isRetryableFootageFailure({ kind: "provider", provider: { ...refusal, kind: "unavailable", status: 503, isRetryable: true } })).toBe(true);
  });
});
