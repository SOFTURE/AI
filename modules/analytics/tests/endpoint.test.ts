// The public funnel endpoint: a beacon or a pixel from one of the app's pages counts its step with
// the page's channel; anything else gets the same answer and counts nothing; 503 only when the
// database fails.
import { handleFunnelBeacon, handleFunnelPixel, MAX_BEACON_BYTES } from "@softure-ai/analytics/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { APP_ORIGIN, createTestFunnel, listCounts, type TestFunnel } from "./support.js";

const ENDPOINT = `${APP_ORIGIN}/api/analytics/funnel`;
const PAGE = `${APP_ORIGIN}/pricing?z=newsletter`;

let funnel: TestFunnel | undefined;

afterEach(async () => {
  await funnel?.database.close();
  funnel = undefined;
  vi.restoreAllMocks();
});

async function setUp(): Promise<TestFunnel> {
  funnel = await createTestFunnel();
  return funnel;
}

function beacon(body: string, headers: Record<string, string> = { referer: PAGE, "sec-fetch-site": "same-origin" }): Request {
  return new Request(ENDPOINT, { method: "POST", body, headers: { "content-type": "text/plain;charset=UTF-8", ...headers } });
}

function pixel(query: string, headers: Record<string, string> = { referer: `${APP_ORIGIN}/?z=newsletter`, "sec-fetch-site": "same-origin" }): Request {
  return new Request(`${ENDPOINT}?${query}`, { headers });
}

async function countsOf(test: TestFunnel) {
  return (await listCounts(test)).map(({ channel, step, count }) => ({ channel, step, count }));
}

describe("the beacon (POST)", () => {
  it("counts a beacon step with the channel of the page it was sent from", async () => {
    const test = await setUp();
    const response = await handleFunnelBeacon(test.ctx, beacon("step=pricing"));
    expect(response.status).toBe(204);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await handleFunnelBeacon(test.ctx, beacon("step=checkout", { referer: `${APP_ORIGIN}/checkout` }));
    expect(await countsOf(test)).toEqual([
      { channel: "", step: "checkout", count: 1 },
      { channel: "newsletter", step: "pricing", count: 1 },
    ]);
  });

  it("answers 204 and counts nothing for input it does not take", async () => {
    const test = await setUp();
    const ignored = [
      beacon("step=pricing", {}),
      beacon("step=pricing", { referer: "https://evil.example.com/?z=newsletter" }),
      beacon("step=pricing", { referer: PAGE, "sec-fetch-site": "cross-site" }),
      beacon("step=pricing", { referer: "not a url" }),
      beacon("step=signup"),
      beacon("step=landing"),
      beacon("step=nope"),
      beacon("step=pricing&step=checkout"),
      beacon(""),
      beacon(`step=pricing&pad=${"x".repeat(MAX_BEACON_BYTES)}`),
    ];
    for (const request of ignored) {
      const response = await handleFunnelBeacon(test.ctx, request);
      expect(response.status).toBe(204);
    }
    expect(await countsOf(test)).toEqual([]);
  });

  it("never takes the channel from its own query, only from the page", async () => {
    const test = await setUp();
    const request = new Request(`${ENDPOINT}?z=forged`, { method: "POST", body: "step=pricing", headers: { referer: `${APP_ORIGIN}/pricing` } });
    await handleFunnelBeacon(test.ctx, request);
    expect(await countsOf(test)).toEqual([{ channel: "", step: "pricing", count: 1 }]);
  });

  it("answers 503 when the count does not reach the database, logging no parameters", async () => {
    const test = await setUp();
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await test.database.close();
    const response = await handleFunnelBeacon(test.ctx, beacon("step=pricing"));
    expect(response.status).toBe(503);
    expect(log).toHaveBeenCalledTimes(1);
    expect(String(log.mock.calls[0]?.[0])).toMatch(/^@softure-ai\/analytics: counting the funnel step "pricing" failed: /);
    expect(String(log.mock.calls[0]?.[0])).not.toContain("newsletter");
    funnel = undefined;
  });
});

describe("the pixel (GET)", () => {
  it("counts a pixel step with the page's channel and answers a 1x1 GIF that is never cached", async () => {
    const test = await setUp();
    const response = await handleFunnelPixel(test.ctx, pixel("step=landing"));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/gif");
    expect(response.headers.get("cache-control")).toBe("no-store");
    const image = new Uint8Array(await response.arrayBuffer());
    expect(new TextDecoder().decode(image.slice(0, 6))).toBe("GIF89a");
    expect(await countsOf(test)).toEqual([{ channel: "newsletter", step: "landing", count: 1 }]);
  });

  it("serves the image and counts nothing without a page of the app, or for another kind of step", async () => {
    const test = await setUp();
    for (const request of [pixel("step=landing", {}), pixel("step=landing&z=forged", { referer: "https://evil.example.com/" }), pixel("step=pricing"), pixel("step=signup")]) {
      const response = await handleFunnelPixel(test.ctx, request);
      expect(response.status).toBe(200);
    }
    expect(await countsOf(test)).toEqual([]);
  });

  it("answers 503 when the count fails", async () => {
    const test = await setUp();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    await test.database.close();
    expect((await handleFunnelPixel(test.ctx, pixel("step=landing"))).status).toBe(503);
    funnel = undefined;
  });
});
