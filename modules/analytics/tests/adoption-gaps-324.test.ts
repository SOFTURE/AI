// Issue #324, point 1: `createFunnelRoute({ getContext })` serves the funnel endpoint over a context the
// app hands in (a test database), so an app no longer keeps a copy of the route to inject one.
import { afterEach, describe, expect, it, vi } from "vitest";
import { APP_ORIGIN, createTestFunnel, listCounts, type TestFunnel } from "./support.js";

vi.mock("next/headers", () => ({ headers: () => Promise.resolve(new Headers()) }));
vi.mock("@softure-ai/core/next", () => ({
  getSoftureConfig: () => {
    throw new Error("the registered config must not be read when getContext is given");
  },
}));

const { createFunnelRoute } = await import("@softure-ai/analytics/next");

const ENDPOINT = `${APP_ORIGIN}/api/analytics/funnel`;
const SAME_ORIGIN = { referer: `${APP_ORIGIN}/pricing?z=newsletter`, "sec-fetch-site": "same-origin" };

let funnel: TestFunnel | undefined;

afterEach(async () => {
  await funnel?.database.close();
  funnel = undefined;
  vi.restoreAllMocks();
});

describe("createFunnelRoute({ getContext })", () => {
  it("counts a beacon and a pixel in the context the app hands in", async () => {
    const test = (funnel = await createTestFunnel());
    const route = createFunnelRoute({ getContext: () => Promise.resolve(test.ctx) });

    const beacon = await route.POST(new Request(ENDPOINT, { method: "POST", body: "step=pricing", headers: { "content-type": "text/plain", ...SAME_ORIGIN } }));
    const pixel = await route.GET(new Request(`${ENDPOINT}?step=landing`, { headers: SAME_ORIGIN }));

    expect([beacon.status, pixel.status]).toEqual([204, 200]);
    expect((await listCounts(test)).map(({ channel, step, count }) => ({ channel, step, count }))).toEqual([
      { channel: "newsletter", step: "landing", count: 1 },
      { channel: "newsletter", step: "pricing", count: 1 },
    ]);
  });

  it("answers 503 without a cache when the app's context fails, and logs it", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const route = createFunnelRoute({ getContext: () => Promise.reject(new Error("connection refused")) });

    const response = await route.POST(new Request(ENDPOINT, { method: "POST", body: "step=pricing", headers: SAME_ORIGIN }));

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(log).toHaveBeenCalledWith("@softure-ai/analytics: opening the database failed: Error");
  });
});
