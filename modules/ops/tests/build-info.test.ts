// The build info answer without Next (`@softure-ai/ops/server`) and the route that mounts it (`@softure-ai/ops/next`).
import { createBuildInfoRoute } from "@softure-ai/ops/next";
import { createBuildInfoResponse, readBuildInfo } from "@softure-ai/ops/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { connection } = vi.hoisted(() => ({ connection: vi.fn(() => Promise.resolve()) }));
vi.mock("next/server", () => ({ connection }));

const STARTED_AT = new Date("2026-10-29T15:00:00.000Z");

beforeEach(() => {
  vi.stubEnv("SOFTURE_RELEASE", "v1.4.0");
  vi.stubEnv("SOFTURE_BUILD_COMMIT", "0123456789abcdef0123456789abcdef01234567");
  vi.stubEnv("SOFTURE_BUILD_TIME", "2026-10-29T14:30:00.000Z");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("readBuildInfo", () => {
  it("reads the release, the commit and the build time from the environment", () => {
    expect(readBuildInfo({ startedAt: STARTED_AT })).toEqual({
      release: "v1.4.0",
      commit: "0123456789abcdef0123456789abcdef01234567",
      builtAt: "2026-10-29T14:30:00.000Z",
      startedAt: "2026-10-29T15:00:00.000Z",
    });
  });

  it("reads the release on every call, so a value set after the import counts", () => {
    vi.stubEnv("SOFTURE_RELEASE", "v1.5.0");
    expect(readBuildInfo().release).toBe("v1.5.0");
  });

  it("answers null for a value that is unset or empty", () => {
    vi.stubEnv("SOFTURE_RELEASE", undefined);
    vi.stubEnv("SOFTURE_BUILD_COMMIT", "");
    vi.stubEnv("SOFTURE_BUILD_TIME", "  ");
    expect(readBuildInfo({ startedAt: STARTED_AT })).toEqual({
      release: null,
      commit: null,
      builtAt: null,
      startedAt: "2026-10-29T15:00:00.000Z",
    });
  });

  it("takes explicit values over the environment, and an explicit null as unset", () => {
    expect(readBuildInfo({ release: "v2.0.0", commit: "abcdef1", builtAt: null, startedAt: STARTED_AT })).toEqual({
      release: "v2.0.0",
      commit: "abcdef1",
      builtAt: null,
      startedAt: "2026-10-29T15:00:00.000Z",
    });
  });

  it("dates the start to the process start, not to the call", () => {
    vi.spyOn(process, "uptime").mockReturnValue(120);
    vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-10-29T15:02:00.000Z"));
    expect(readBuildInfo().startedAt).toBe("2026-10-29T15:00:00.000Z");
  });
});

describe("createBuildInfoResponse", () => {
  it("answers 200 with the build info, never cached", async () => {
    const response = await createBuildInfoResponse({ startedAt: STARTED_AT });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      release: "v1.4.0",
      commit: "0123456789abcdef0123456789abcdef01234567",
      builtAt: "2026-10-29T14:30:00.000Z",
      startedAt: "2026-10-29T15:00:00.000Z",
    });
  });

  it("adds the changelog the provider returns, sync or async", async () => {
    const changelog = [{ roadmap: "context/foundation/roadmap.md", items: [{ id: "AB-1", changeId: "ab-1", status: "done" }] }];
    const fromSync = await createBuildInfoResponse({ startedAt: STARTED_AT, changelog: () => changelog });
    expect(await fromSync.json()).toMatchObject({ release: "v1.4.0", changelog });
    const fromAsync = await createBuildInfoResponse({ startedAt: STARTED_AT, changelog: () => Promise.resolve(changelog) });
    expect(await fromAsync.json()).toMatchObject({ changelog });
  });

  it("answers changelog null and logs the error class when the provider fails, keeping the build info", async () => {
    const errors: unknown[][] = [];
    vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      errors.push(args);
    });
    const response = await createBuildInfoResponse({
      startedAt: STARTED_AT,
      changelog: () => Promise.reject(new TypeError("secret detail")),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ release: "v1.4.0", changelog: null });
    expect(errors).toEqual([["build info: the changelog provider failed: TypeError"]]);
  });
});

describe("createBuildInfoRoute", () => {
  it("opts into dynamic rendering with connection() on every request, then answers the build info", async () => {
    connection.mockClear();
    const GET = createBuildInfoRoute({ startedAt: STARTED_AT });
    await GET();
    const response = await GET();
    expect(connection).toHaveBeenCalledTimes(2);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toMatchObject({ release: "v1.4.0", startedAt: "2026-10-29T15:00:00.000Z" });
  });
});
