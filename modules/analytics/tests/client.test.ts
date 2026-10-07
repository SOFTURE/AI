// The browser's beacon: only the step leaves the browser, once per step per reporter, and a missing
// or failing `sendBeacon` never breaks the page. The channel keeper: the last valid tag seen in the
// address bar goes back on a URL that lost it.
import { buildFunnelBody, createChannelKeeper, createFunnelReporter, type ChannelRule } from "@softure-ai/analytics/client";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createFunnelReporter", () => {
  it("sends step=<id> to the endpoint, each step once", () => {
    const sendBeacon = vi.fn(() => true);
    const report = createFunnelReporter("/api/analytics/funnel", { sendBeacon });
    report("pricing");
    report("pricing");
    report("checkout");
    expect(sendBeacon.mock.calls).toEqual([
      ["/api/analytics/funnel", "step=pricing"],
      ["/api/analytics/funnel", "step=checkout"],
    ]);
  });

  it("does nothing without sendBeacon, and swallows a failing one with a debug line naming no URL", () => {
    expect(() => {
      createFunnelReporter("/f", {})("pricing");
      createFunnelReporter("/f", undefined)("pricing");
    }).not.toThrow();

    const debug = vi.spyOn(console, "debug").mockImplementation(() => undefined);
    const report = createFunnelReporter("/f", {
      sendBeacon: () => {
        throw new TypeError("https://app.example.com/secret?z=newsletter");
      },
    });
    expect(() => {
      report("pricing");
    }).not.toThrow();
    expect(debug).toHaveBeenCalledWith("@softure-ai/analytics: the funnel beacon failed: TypeError");
  });
});

describe("buildFunnelBody", () => {
  it("encodes the step as a form body", () => {
    expect(buildFunnelBody("pricing-page")).toBe("step=pricing-page");
  });
});

const DEFAULT_RULE: ChannelRule = { param: "z", pattern: "^[a-z0-9]+(?:[-_][a-z0-9]+)*$", flags: "", maxLength: 32 };

describe("createChannelKeeper", () => {
  it("leaves a tagged URL alone and puts its tag back on the next URL without one, keeping the rest", () => {
    const keep = createChannelKeeper(DEFAULT_RULE);
    expect(keep("https://app.example.com/login?z=spring-promo")).toBeNull();
    expect(keep("https://app.example.com/register?plan=pro#form")).toBe("https://app.example.com/register?plan=pro&z=spring-promo#form");
    expect(keep("https://app.example.com/pricing")).toBe("https://app.example.com/pricing?z=spring-promo");
  });

  it("does nothing while no tag has been seen", () => {
    const keep = createChannelKeeper(DEFAULT_RULE);
    expect(keep("https://app.example.com/")).toBeNull();
    expect(keep("https://app.example.com/pricing")).toBeNull();
  });

  it("lets a newer valid tag replace the remembered one", () => {
    const keep = createChannelKeeper(DEFAULT_RULE);
    keep("https://app.example.com/?z=ads");
    expect(keep("https://app.example.com/?z=newsletter")).toBeNull();
    expect(keep("https://app.example.com/pricing")).toBe("https://app.example.com/pricing?z=newsletter");
  });

  it("leaves an invalid or too long value alone and forgets the remembered tag", () => {
    const keep = createChannelKeeper(DEFAULT_RULE);
    keep("https://app.example.com/?z=ads");
    expect(keep("https://app.example.com/?z=Not%20Valid")).toBeNull();
    expect(keep("https://app.example.com/pricing")).toBeNull();
    keep("https://app.example.com/?z=ads");
    expect(keep(`https://app.example.com/?z=${"a".repeat(33)}`)).toBeNull();
    expect(keep("https://app.example.com/pricing")).toBeNull();
    keep("https://app.example.com/?z=ads");
    expect(keep("https://app.example.com/?z=")).toBeNull();
    expect(keep("https://app.example.com/pricing")).toBeNull();
  });

  it("follows a custom parameter, pattern, flags and length", () => {
    const keep = createChannelKeeper({ param: "src", pattern: "^[a-z]+$", flags: "i", maxLength: 4 });
    expect(keep("https://app.example.com/?src=Mail&z=ads")).toBeNull();
    expect(keep("https://app.example.com/pricing?z=ads")).toBe("https://app.example.com/pricing?z=ads&src=Mail");
    keep("https://app.example.com/?src=email");
    expect(keep("https://app.example.com/pricing")).toBeNull();
  });

  it("returns null for an href that is not a URL", () => {
    const keep = createChannelKeeper(DEFAULT_RULE);
    keep("https://app.example.com/?z=ads");
    expect(keep("not a url")).toBeNull();
    expect(keep("https://app.example.com/pricing")).toBe("https://app.example.com/pricing?z=ads");
  });
});

describe("tagLink", () => {
  const RULE: ChannelRule = { ...DEFAULT_RULE, origins: ["https://app.example.com", "https://example.com"] };
  const PAGE = "https://example.com/kalkulator?z=fb";

  it("adds the remembered tag to a link that leads to another configured origin", () => {
    const keep = createChannelKeeper(RULE);
    keep(PAGE);
    expect(keep.tagLink("https://app.example.com/register?plan=pro#form", PAGE)).toBe("https://app.example.com/register?plan=pro&z=fb#form");
  });

  it("leaves same-origin, unconfigured, non-http and already tagged links alone", () => {
    const keep = createChannelKeeper(RULE);
    keep(PAGE);
    expect(keep.tagLink("/register", PAGE)).toBeNull();
    expect(keep.tagLink("https://example.com/blog", PAGE)).toBeNull();
    expect(keep.tagLink("https://other.example.net/register", PAGE)).toBeNull();
    expect(keep.tagLink("mailto:hello@example.com", PAGE)).toBeNull();
    expect(keep.tagLink("https://app.example.com/register?z=other", PAGE)).toBeNull();
    expect(keep.tagLink("http://[bad", PAGE)).toBeNull();
  });

  it("does nothing while no tag has been seen, or without origins in the rule", () => {
    const keep = createChannelKeeper(RULE);
    expect(keep.tagLink("https://app.example.com/register", "https://example.com/")).toBeNull();
    const plain = createChannelKeeper(DEFAULT_RULE);
    plain(PAGE);
    expect(plain.tagLink("https://app.example.com/register", PAGE)).toBeNull();
  });

  it("applies the rule's normalisation to the remembered tag", () => {
    const keep = createChannelKeeper({ ...RULE, normalize: "trim-lowercase" });
    keep("https://example.com/?z=FB");
    expect(keep.tagLink("https://app.example.com/register", "https://example.com/?z=FB")).toBe("https://app.example.com/register?z=fb");
  });
});
