// The browser's beacon: only the step leaves the browser, once per step per reporter, and a missing
// or failing `sendBeacon` never breaks the page.
import { buildFunnelBody, createFunnelReporter } from "@softure-ai/analytics/client";
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
