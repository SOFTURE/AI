// The Next.js adapter: the channel from the page an action was posted from, from a page's own
// search params, and handed to auth's onRegistered hook.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { APP_ORIGIN, createConfig } from "./support.js";

const requestHeaders = new Headers();
vi.mock("next/headers", () => ({ headers: () => Promise.resolve(requestHeaders) }));

const config = createConfig();
vi.mock("@softure-ai/core/next", () => ({ getSoftureConfig: () => config }));

const { attributeRegistration, getChannel, getChannelFromSearchParams } = await import("@softure-ai/analytics/next");

beforeEach(() => {
  for (const name of [...requestHeaders.keys()]) requestHeaders.delete(name);
});

describe("getChannel", () => {
  it("reads the channel of the same-origin page the request was sent from", async () => {
    requestHeaders.set("referer", `${APP_ORIGIN}/register?z=newsletter`);
    expect(await getChannel()).toBe("newsletter");
  });

  it("accepts the request's Host as the origin, for an app reached on another address", async () => {
    requestHeaders.set("host", "localhost:3100");
    requestHeaders.set("referer", "http://localhost:3100/register?z=ads");
    expect(await getChannel(config)).toBe("ads");
  });

  it("returns null without a Referer, from another origin, or with an invalid value", async () => {
    expect(await getChannel()).toBeNull();
    requestHeaders.set("referer", "https://evil.example.com/register?z=newsletter");
    expect(await getChannel()).toBeNull();
    requestHeaders.set("referer", `${APP_ORIGIN}/register?z=NOPE`);
    expect(await getChannel()).toBeNull();
  });
});

describe("getChannelFromSearchParams", () => {
  it("reads a page's awaited searchParams, taking the first of repeated values", () => {
    expect(getChannelFromSearchParams({ z: "ads" })).toBe("ads");
    expect(getChannelFromSearchParams({ z: ["ads", "other"] })).toBe("ads");
    expect(getChannelFromSearchParams({ z: undefined })).toBeNull();
    expect(getChannelFromSearchParams({})).toBeNull();
    expect(getChannelFromSearchParams({ z: "Bad Value" })).toBeNull();
  });

  it("reads URLSearchParams", () => {
    expect(getChannelFromSearchParams(new URLSearchParams("z=ads&z=other"), config)).toBe("ads");
    expect(getChannelFromSearchParams(new URLSearchParams("y=ads"), config)).toBeNull();
  });
});

describe("attributeRegistration", () => {
  const event = { user: { id: "user-1", email: "a@example.com", createdAt: new Date() }, consent: null };

  it("hands the new account and its channel to the app, with the hook's context", async () => {
    requestHeaders.set("referer", `${APP_ORIGIN}/register?z=newsletter`);
    const onChannel = vi.fn();
    const ctx = { config, db: "transaction" };
    await attributeRegistration(onChannel)(event, ctx);
    expect(onChannel).toHaveBeenCalledExactlyOnceWith({ userId: "user-1", channel: "newsletter" }, ctx);
  });

  it("does nothing for a sign-up without a channel", async () => {
    const onChannel = vi.fn();
    await attributeRegistration(onChannel)(event, { config });
    expect(onChannel).not.toHaveBeenCalled();
  });

  it("lets the app's failure propagate, so auth rolls the account back", async () => {
    requestHeaders.set("referer", `${APP_ORIGIN}/register?z=newsletter`);
    const hook = attributeRegistration(() => Promise.reject(new Error("channel store is down")));
    await expect(hook(event, { config })).rejects.toThrow("channel store is down");
  });
});
