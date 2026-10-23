// Renaming the channel parameter (`?z=` → `?ref=`) without losing links already shared: every reader
// takes `param`, then each of `legacyParams`; the package writes `param` only, and the tagger and the
// keeper move a legacy name to `param` in the address bar. A cached page's old channel field still counts.
import { analytics } from "@softure-ai/analytics";
import { createChannelKeeper } from "@softure-ai/analytics/client";
import { createChannelTagger } from "@softure-ai/analytics/proxy";
import { getChannelRule, handleFunnelBeacon, hasChannelParam, readChannel, tagPath, withChannel } from "@softure-ai/analytics/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { APP_ORIGIN, createConfig, createRequest, createTestFunnel, FUNNEL_STEPS, listCounts, type TestFunnel } from "./support.js";

const RENAMED = { param: "ref", legacyParams: ["z"] };
const config = createConfig({ channel: RENAMED });

vi.mock("next/headers", () => ({ headers: () => Promise.resolve(new Headers()) }));
vi.mock("@softure-ai/core/next", () => ({ getSoftureConfig: () => config }));

const { getChannelFromSearchParams } = await import("@softure-ai/analytics/next");

describe("channel.legacyParams options", () => {
  it("defaults to none, so the rule hands the browser an empty list", () => {
    expect(getChannelRule(createConfig()).legacyParams).toEqual([]);
    expect(getChannelRule(config).legacyParams).toEqual(["z"]);
  });

  it("refuses a name the param rule refuses, the current param, a repeat and more than 4 names", () => {
    expect(() => analytics({ channel: { param: "ref", legacyParams: ["Z", "ref", "z", "z"] } })).toThrow(
      [
        'Invalid SOFTURE configuration in module "analytics":',
        "- options.channel.legacyParams.0: must be lowercase letters, digits, - or _, starting with a letter, at most 32 characters",
        '- options.channel.legacyParams.1: "ref" is the current param',
        '- options.channel.legacyParams.3: "z" is listed twice',
      ].join("\n"),
    );
    expect(() => analytics({ channel: { legacyParams: ["a", "b", "c", "d", "e"] } })).toThrow("- options.channel.legacyParams: takes at most 4 names");
  });

  it("refuses a channel field list naming a step field, a field twice, none or more than 4", () => {
    expect(() => analytics({ funnel: { wire: { stepFields: ["step"], channelField: ["ref", "step", "ref"] } } })).toThrow(
      [
        'Invalid SOFTURE configuration in module "analytics":',
        '- options.funnel.wire.channelField.1: "step" already names the step',
        '- options.funnel.wire.channelField.2: "ref" is listed twice',
      ].join("\n"),
    );
    expect(() => analytics({ funnel: { wire: { channelField: [] } } })).toThrow("- options.funnel.wire.channelField: needs at least one field");
    expect(() => analytics({ funnel: { wire: { channelField: ["a", "b", "c", "d", "e"] } } })).toThrow("- options.funnel.wire.channelField: takes at most 4 fields");
  });
});

describe("server readers and writers", () => {
  it("reads the legacy name in the request URL and in a first-party Referer, the current name winning", () => {
    expect(readChannel(config, { url: `${APP_ORIGIN}/?z=reddit` })).toBe("reddit");
    expect(readChannel(config, { url: `${APP_ORIGIN}/?ref=reddit` })).toBe("reddit");
    expect(readChannel(config, { url: `${APP_ORIGIN}/?z=old&ref=new` })).toBe("new");
    expect(readChannel(config, { referer: `${APP_ORIGIN}/?z=reddit`, host: "app.example.com" })).toBe("reddit");
    expect(readChannel(config, { referer: "https://evil.example.com/?z=reddit", host: "app.example.com" })).toBeNull();
  });

  it("lets the first name present decide, valid or not", () => {
    expect(readChannel(config, { url: `${APP_ORIGIN}/?ref=NOT%20VALID&z=reddit` })).toBeNull();
    expect(readChannel(config, { url: `${APP_ORIGIN}/?z=NOT%20VALID`, referer: `${APP_ORIGIN}/?ref=ads` })).toBeNull();
  });

  it("applies the same normalization to a legacy name", () => {
    const normalizing = createConfig({ channel: { ...RENAMED, normalize: "trim-lowercase" } });
    expect(readChannel(normalizing, { url: `${APP_ORIGIN}/?z=%20Reddit%20` })).toBe("reddit");
  });

  it("counts a legacy name as carrying the parameter", () => {
    expect(hasChannelParam(config, new URL(`${APP_ORIGIN}/?z=reddit`))).toBe(true);
    expect(hasChannelParam(config, new URL(`${APP_ORIGIN}/?q=1`))).toBe(false);
  });

  it("writes the current name only and drops the legacy one", () => {
    expect(withChannel(config, new URL(`${APP_ORIGIN}/pricing?z=old&plan=pro`), "reddit").href).toBe(`${APP_ORIGIN}/pricing?plan=pro&ref=reddit`);
    expect(tagPath(config, "/thanks", "reddit")).toBe("/thanks?ref=reddit");
    expect(tagPath(config, "/thanks?z=old", "reddit")).toBe("/thanks?z=old");
  });

  it("reads a page's search params under the legacy name, in both input kinds", () => {
    expect(getChannelFromSearchParams({ z: "reddit" })).toBe("reddit");
    expect(getChannelFromSearchParams({ z: ["reddit", "other"] })).toBe("reddit");
    expect(getChannelFromSearchParams({ z: "old", ref: "new" })).toBe("new");
    expect(getChannelFromSearchParams(new URLSearchParams("z=reddit"), config)).toBe("reddit");
    expect(getChannelFromSearchParams(new URLSearchParams("z=old&ref=new"), config)).toBe("new");
    expect(getChannelFromSearchParams({ q: "1" })).toBeNull();
  });
});

describe("the keeper", () => {
  const RULE = { param: "ref", legacyParams: ["z"], pattern: "^[a-z0-9-]+$", flags: "", maxLength: 32, origins: [APP_ORIGIN, "https://example.com"] };

  it("moves a valid legacy tag to the current name and keeps it on later navigations", () => {
    const keep = createChannelKeeper(RULE);
    expect(keep(`${APP_ORIGIN}/post?z=reddit#top`)).toBe(`${APP_ORIGIN}/post?ref=reddit#top`);
    expect(keep(`${APP_ORIGIN}/post?ref=reddit#top`)).toBeNull();
    expect(keep(`${APP_ORIGIN}/pricing`)).toBe(`${APP_ORIGIN}/pricing?ref=reddit`);
  });

  it("drops a legacy name next to the current one, which wins", () => {
    const keep = createChannelKeeper(RULE);
    expect(keep(`${APP_ORIGIN}/?z=old&ref=new`)).toBe(`${APP_ORIGIN}/?ref=new`);
    expect(keep(`${APP_ORIGIN}/pricing`)).toBe(`${APP_ORIGIN}/pricing?ref=new`);
  });

  it("leaves an invalid legacy value untouched and forgets the tag", () => {
    const keep = createChannelKeeper(RULE);
    keep(`${APP_ORIGIN}/?ref=ads`);
    expect(keep(`${APP_ORIGIN}/?z=NOT%20VALID`)).toBeNull();
    expect(keep(`${APP_ORIGIN}/pricing`)).toBeNull();
  });

  it("tags a link to another origin with the current name, and leaves one carrying a legacy name", () => {
    const keep = createChannelKeeper(RULE);
    keep(`${APP_ORIGIN}/?z=reddit`);
    expect(keep.tagLink("https://example.com/blog", `${APP_ORIGIN}/`)).toBe("https://example.com/blog?ref=reddit");
    expect(keep.tagLink("https://example.com/blog?z=x", `${APP_ORIGIN}/`)).toBeNull();
  });
});

describe("the tagger", () => {
  const channels = createChannelTagger(config);

  it("renames a navigation carrying only a valid legacy name with a 307", () => {
    const response = channels.tag(createRequest("/post?z=reddit&page=2"));
    expect(response?.status).toBe(307);
    expect(response?.headers.get("location")).toBe(`${APP_ORIGIN}/post?page=2&ref=reddit`);
  });

  it("leaves a navigation with the current name, or an invalid legacy value, alone", () => {
    expect(channels.tag(createRequest("/post?z=old&ref=new"))).toBeNull();
    expect(channels.tag(createRequest("/post?z=NOT%20VALID", { referer: `${APP_ORIGIN}/?ref=ads` }))).toBeNull();
  });

  it("renames only the navigations targets accepts", () => {
    const scoped = createChannelTagger(config, { targets: ["/register"] });
    expect(scoped.tag(createRequest("/post?z=reddit"))).toBeNull();
    expect(scoped.tag(createRequest("/register?z=reddit"))?.headers.get("location")).toBe(`${APP_ORIGIN}/register?ref=reddit`);
  });

  it("tags a navigation and carries a redirect from a page tagged with the legacy name, under the current name", () => {
    expect(channels.tag(createRequest("/register", { referer: `${APP_ORIGIN}/?z=reddit` }))?.headers.get("location")).toBe(`${APP_ORIGIN}/register?ref=reddit`);
    const carried = channels.carry(createRequest("/account", { referer: `${APP_ORIGIN}/?z=reddit` }), new Response(null, { status: 307, headers: { location: "/login" } }));
    expect(carried?.headers.get("location")).toBe("/login?ref=reddit");
  });

  it("does not derive a channel from the path of a page that carries a legacy name", () => {
    const deriving = createChannelTagger(config, { channelFromReferer: () => "blog" });
    expect(deriving.tag(createRequest("/register", { referer: `${APP_ORIGIN}/post?z=NOT%20VALID` }))).toBeNull();
    expect(deriving.tag(createRequest("/register", { referer: `${APP_ORIGIN}/post` }))?.headers.get("location")).toBe(`${APP_ORIGIN}/register?ref=blog`);
  });
});

describe("the funnel endpoint", () => {
  const ENDPOINT = `${APP_ORIGIN}/api/analytics/funnel`;
  let funnel: TestFunnel | undefined;

  afterEach(async () => {
    await funnel?.database.close();
    funnel = undefined;
  });

  const beacon = (body: string, page: string) => new Request(ENDPOINT, { method: "POST", body, headers: { referer: page, "sec-fetch-site": "same-origin" } });

  it("reads a Referer tagged with the legacy name and a cached page's old channel field, one value in all", async () => {
    funnel = await createTestFunnel({ channel: RENAMED, funnel: { steps: [...FUNNEL_STEPS], wire: { channelField: ["ref", "z"] } } });
    await handleFunnelBeacon(funnel.ctx, beacon("step=pricing", `${APP_ORIGIN}/pricing?z=reddit`));
    await handleFunnelBeacon(funnel.ctx, beacon("step=pricing&z=ads", `${APP_ORIGIN}/pricing`));
    await handleFunnelBeacon(funnel.ctx, beacon("step=checkout&ref=ads", `${APP_ORIGIN}/pricing`));
    await handleFunnelBeacon(funnel.ctx, beacon("step=checkout&ref=ads&z=other", `${APP_ORIGIN}/pricing`));
    expect((await listCounts(funnel)).map(({ channel, step, count }) => ({ channel, step, count }))).toEqual([
      { channel: "", step: "checkout", count: 1 },
      { channel: "ads", step: "checkout", count: 1 },
      { channel: "ads", step: "pricing", count: 1 },
      { channel: "reddit", step: "pricing", count: 1 },
    ]);
  });
});
