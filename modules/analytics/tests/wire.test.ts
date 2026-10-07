// An app that already counts a funnel keeps its links and cached pages working: the step may come
// under an older field name, a page may send its channel itself, a page without a tag gets a channel
// from its path, and a tag written with capitals or spaces is repaired.
import { buildFunnelBody, createChannelKeeper, createFunnelReporter } from "@softure-ai/analytics/client";
import { getChannelRule, getFunnelStepField, handleFunnelBeacon, handleFunnelPixel, parseChannel, readChannel, recordFunnelStep } from "@softure-ai/analytics/server";
import type { AnalyticsOptionsInput } from "@softure-ai/analytics";
import { afterEach, describe, expect, it, vi } from "vitest";
import { APP_ORIGIN, createConfig, createTestFunnel, FUNNEL_STEPS, listCounts, type TestFunnel } from "./support.js";

const ENDPOINT = `${APP_ORIGIN}/api/analytics/funnel`;
const SAME_ORIGIN = { "sec-fetch-site": "same-origin" };

let funnel: TestFunnel | undefined;

afterEach(async () => {
  await funnel?.database.close();
  funnel = undefined;
  vi.restoreAllMocks();
});

async function setUp(options: Omit<NonNullable<AnalyticsOptionsInput["funnel"]>, "steps"> = {}, channel: AnalyticsOptionsInput["channel"] = {}): Promise<TestFunnel> {
  funnel = await createTestFunnel({ channel, funnel: { steps: [...FUNNEL_STEPS, { id: "article", via: "pixel" }], ...options } });
  return funnel;
}

const beacon = (body: string, page = `${APP_ORIGIN}/pricing`) => new Request(ENDPOINT, { method: "POST", body, headers: { referer: page, ...SAME_ORIGIN } });
const pixel = (query: string, page: string) => new Request(`${ENDPOINT}?${query}`, { headers: { referer: page, ...SAME_ORIGIN } });

async function countsOf(test: TestFunnel) {
  return (await listCounts(test)).map(({ channel, step, count }) => ({ channel, step, count }));
}

describe("funnel.wire", () => {
  it("counts a step under every configured field, and none named twice", async () => {
    const test = await setUp({ wire: { stepFields: ["step", "k"] } });
    await handleFunnelBeacon(test.ctx, beacon("k=pricing"));
    await handleFunnelBeacon(test.ctx, beacon("step=pricing"));
    await handleFunnelBeacon(test.ctx, beacon("k=pricing&step=pricing"));
    await handleFunnelBeacon(test.ctx, beacon("k=pricing&k=checkout"));
    expect(await countsOf(test)).toEqual([{ channel: "", step: "pricing", count: 2 }]);
  });

  it("takes the default field only by default", async () => {
    const test = await setUp();
    await handleFunnelBeacon(test.ctx, beacon("k=pricing"));
    expect(await countsOf(test)).toEqual([]);
  });

  it("takes a valid channel the beacon or pixel sends, else the page's", async () => {
    const test = await setUp({ wire: { stepFields: ["k"], channelField: "z" } });
    await handleFunnelBeacon(test.ctx, beacon("k=pricing&z=ads"));
    await handleFunnelBeacon(test.ctx, beacon("k=pricing&z=ads", `${APP_ORIGIN}/pricing?z=newsletter`));
    await handleFunnelBeacon(test.ctx, beacon("k=checkout&z=NOT%20VALID", `${APP_ORIGIN}/pricing?z=newsletter`));
    await handleFunnelBeacon(test.ctx, beacon("k=checkout&z=a&z=b"));
    await handlePixel(test, "k=landing&z=ads");
    expect(await countsOf(test)).toEqual([
      { channel: "", step: "checkout", count: 1 },
      { channel: "ads", step: "landing", count: 1 },
      { channel: "ads", step: "pricing", count: 2 },
      { channel: "newsletter", step: "checkout", count: 1 },
    ]);
  });

  it("ignores a channel field it is not configured to read", async () => {
    const test = await setUp();
    await handleFunnelBeacon(test.ctx, beacon("step=pricing&z=ads"));
    expect(await countsOf(test)).toEqual([{ channel: "", step: "pricing", count: 1 }]);
  });

  it("makes the package's beacon and pixel send the first field", () => {
    expect(getFunnelStepField(createConfig())).toBe("step");
    expect(getFunnelStepField(createConfig({ funnel: { wire: { stepFields: ["k", "step"] } } }))).toBe("k");
    expect(buildFunnelBody("pricing", "k")).toBe("k=pricing");
    const sent: unknown[] = [];
    createFunnelReporter("/count", { sendBeacon: (url, data) => sent.push([url, data]) > 0 }, { stepField: "k" })("pricing");
    expect(sent).toEqual([["/count", "k=pricing"]]);
  });
});

async function handlePixel(test: TestFunnel, query: string, page = `${APP_ORIGIN}/`) {
  return handleFunnelPixel(test.ctx, pixel(query, page));
}

describe("funnel.channelFromReferer", () => {
  const fromBlog = (page: URL) => (page.pathname.startsWith("/blog/") ? "blog" : null);

  it("gives a page without a tag the channel of its path, never overriding a tag", async () => {
    const test = await setUp({ channelFromReferer: fromBlog });
    await handlePixel(test, "step=article", `${APP_ORIGIN}/blog/index-funds`);
    await handlePixel(test, "step=article", `${APP_ORIGIN}/blog/index-funds?z=newsletter`);
    await handlePixel(test, "step=landing", `${APP_ORIGIN}/`);
    expect(await countsOf(test)).toEqual([
      { channel: "", step: "landing", count: 1 },
      { channel: "blog", step: "article", count: 1 },
      { channel: "newsletter", step: "article", count: 1 },
    ]);
  });

  it("passes its answer through the channel rule and survives a throw", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const invalid = await setUp({ channelFromReferer: () => "Not Valid" });
    await handlePixel(invalid, "step=article", `${APP_ORIGIN}/blog/a`);
    expect(await countsOf(invalid)).toEqual([{ channel: "", step: "article", count: 1 }]);
    await invalid.database.close();
    const throwing = await setUp({ channelFromReferer: () => { throw new Error("bad hook"); } });
    expect((await handlePixel(throwing, "step=article", `${APP_ORIGIN}/blog/a`)).status).toBe(200);
    expect(await countsOf(throwing)).toEqual([{ channel: "", step: "article", count: 1 }]);
    expect(errors).toHaveBeenCalledWith("@softure-ai/analytics: funnel.channelFromReferer failed: bad hook");
  });
});

describe("channel.normalize", () => {
  const rule = { pattern: /^[a-z0-9-]+$/, maxLength: 20 };

  it("repairs capitals and spaces before the check with trim-lowercase, and nothing by default", () => {
    expect(parseChannel(" Newsletter ", { ...rule, normalize: "trim-lowercase" })).toBe("newsletter");
    expect(parseChannel(" Newsletter ", rule)).toBeNull();
    expect(parseChannel("   ", { ...rule, normalize: "trim-lowercase" })).toBeNull();
    expect(parseChannel("x".repeat(21), { ...rule, normalize: "trim-lowercase" })).toBeNull();
  });

  it("applies in readChannel, the browser keeper and the counter", async () => {
    const config = createConfig({ channel: { normalize: "trim-lowercase" } });
    expect(readChannel(config, { url: `${APP_ORIGIN}/?z=%20Ads%20` })).toBe("ads");
    expect(getChannelRule(config).normalize).toBe("trim-lowercase");
    const keep = createChannelKeeper(getChannelRule(config));
    expect(keep(`${APP_ORIGIN}/?z=Ads`)).toBeNull();
    expect(keep(`${APP_ORIGIN}/next`)).toBe(`${APP_ORIGIN}/next?z=ads`);
    const test = await setUp({}, { normalize: "trim-lowercase" });
    await recordFunnelStep(test.ctx, { step: "signup", channel: "Ads" });
    expect(await countsOf(test)).toEqual([{ channel: "ads", step: "signup", count: 1 }]);
  });
});
