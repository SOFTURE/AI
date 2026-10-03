// The Next.js adapter: the channel from the page an action was posted from, from a page's own
// search params, handed to auth's onRegistered hook, counted as a funnel step on sign-up, and the
// channel keeper's rule handed to the browser.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { sql } from "drizzle-orm";
import { Suspense, type ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { APP_ORIGIN, createConfig, createTestFunnel, listCounts, type TestFunnel } from "./support.js";

const requestHeaders = new Headers();
vi.mock("next/headers", () => ({ headers: () => Promise.resolve(requestHeaders) }));

const config = createConfig();
vi.mock("@softure-ai/core/next", () => ({ getSoftureConfig: () => config }));

const { attributeRegistration, countRegistration, getChannel, getChannelFromSearchParams } = await import("@softure-ai/analytics/next");
const { ChannelKeeper } = await import("@softure-ai/analytics/next/channel-keeper");
const { getChannelRule } = await import("@softure-ai/analytics/server");

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

describe("countRegistration", () => {
  const event = { user: { id: "user-1" } };
  let funnel: TestFunnel | undefined;

  afterEach(async () => {
    await funnel?.database.close();
    funnel = undefined;
    vi.restoreAllMocks();
  });

  /** Runs the hook inside a transaction, as auth does, and a statement after it. */
  async function register(test: TestFunnel, hook: ReturnType<typeof countRegistration>): Promise<void> {
    await test.database.db.transaction(async (tx) => {
      await hook(event, { ...test.ctx, db: tx });
      await tx.execute(sql`select 1`);
    });
  }

  it("counts every sign-up under its step, with its channel or without one", async () => {
    const test = (funnel = await createTestFunnel());
    requestHeaders.set("referer", `${APP_ORIGIN}/register?z=newsletter`);
    await register(test, countRegistration("signup"));
    requestHeaders.delete("referer");
    await register(test, countRegistration("signup"));
    expect((await listCounts(test)).map(({ channel, step, count }) => ({ channel, step, count }))).toEqual([
      { channel: "", step: "signup", count: 1 },
      { channel: "newsletter", step: "signup", count: 1 },
    ]);
  });

  it("logs a failed count and leaves the account's transaction usable", async () => {
    const test = (funnel = await createTestFunnel());
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    // A database refusal (the step breaks the table's check) and a step the funnel does not declare.
    await test.database.client.query("ALTER TABLE analytics.funnel_counts ADD CONSTRAINT no_signups CHECK (step <> 'signup')");
    await expect(register(test, countRegistration("signup"))).resolves.toBeUndefined();
    await expect(register(test, countRegistration("sign-up"))).resolves.toBeUndefined();
    expect(log.mock.calls.map(([line]) => String(line).split(": ")[1])).toEqual([
      'counting the funnel step "signup" for a sign-up failed',
      'counting the funnel step "sign-up" for a sign-up failed',
    ]);
    expect(await listCounts(test)).toEqual([]);
  });
});

describe("getChannelRule", () => {
  it("hands the default channel options to the browser as plain values", () => {
    expect(getChannelRule(createConfig())).toEqual({ param: "z", pattern: "^[a-z0-9]+(?:[-_][a-z0-9]+)*$", flags: "", maxLength: 32 });
  });

  it("hands a custom parameter, pattern with flags and length over exactly", () => {
    expect(getChannelRule(createConfig({ channel: { param: "src", pattern: /^[a-z]+$/i, maxLength: 12 } }))).toEqual({
      param: "src",
      pattern: "^[a-z]+$",
      flags: "i",
      maxLength: 12,
    });
  });

  it("throws when the module is not enabled", () => {
    expect(() => getChannelRule({ ...config, modules: [] })).toThrow("@softure-ai/analytics: the module is not enabled");
  });
});

describe("ChannelKeeper", () => {
  it("renders the browser keeper with the app's rule inside a Suspense boundary that shows nothing", () => {
    const element = ChannelKeeper() as ReactElement<{ fallback: unknown; children: ReactElement<{ rule: unknown }, (props: { rule: unknown }) => null> }>;
    expect(element.type).toBe(Suspense);
    expect(element.props.fallback).toBeNull();
    expect(element.props.children.type.name).toBe("ChannelKeeperClient");
    expect(element.props.children.props.rule).toEqual(getChannelRule(config));
  });
});

describe("the /next entry point", () => {
  it("never reaches next/navigation, so softure.config.ts can import it in plain Node", () => {
    const sourceDir = fileURLToPath(new URL("../src/", import.meta.url));
    const seen = new Set<string>();
    const visit = (file: string): string[] => {
      if (seen.has(file)) return [];
      seen.add(file);
      const code = readFileSync(file, "utf8");
      const found = /from "next\/navigation"/.test(code) ? [relative(sourceDir, file)] : [];
      for (const [, specifier] of code.matchAll(/^(?:import|export) [^;]*? from "(\.{1,2}\/[^"]+)"/gm)) {
        const target = resolve(dirname(file), specifier ?? "");
        const source = [target.replace(/\.js$/, ".ts"), target.replace(/\.js$/, ".tsx")].find((candidate) => existsSync(candidate));
        if (source !== undefined) found.push(...visit(source));
      }
      return found;
    };
    expect(visit(join(sourceDir, "next/index.ts"))).toEqual([]);
    expect(visit(join(sourceDir, "next/channel-keeper.tsx"))).toEqual(["next/channel-keeper-client.tsx"]);
  });
});
