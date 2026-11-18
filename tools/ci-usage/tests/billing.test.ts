import { describe, expect, it } from "vitest";
import { getBillingUsage, parseBillingAccount } from "../src/billing.js";
import { createGithubClient } from "../src/github.js";
import { createFakeGithub } from "./fake-github.js";

function item(overrides: Record<string, unknown>): Record<string, unknown> {
  return { date: "2026-11-17T00:00:00Z", product: "actions", sku: "actions_linux", quantity: 10, unitType: "Minutes", netAmount: 0.06, grossAmount: 0.06, repositoryName: "app", ...overrides };
}

describe("parseBillingAccount", () => {
  it("reads org: and user: and refuses anything else", () => {
    expect(parseBillingAccount("")).toBeNull();
    expect(parseBillingAccount("org:acme")).toEqual({ ok: true, account: { kind: "org", name: "acme" } });
    expect(parseBillingAccount("user:someone")).toEqual({ ok: true, account: { kind: "user", name: "someone" } });
    expect(parseBillingAccount("team:x")).toEqual({ ok: false, error: '--billing must be org:<organization> or user:<user>, not "team:x"' });
  });
});

describe("getBillingUsage", () => {
  const from = new Date("2026-11-16T00:00:00Z");
  const to = new Date("2026-11-18T00:00:00Z");

  it("sums the period's Actions minutes per repository and SKU", async () => {
    const fake = createFakeGithub([
      {
        match: (url) => url.pathname === "/organizations/acme/settings/billing/usage",
        body: {
          usageItems: [
            item({}),
            item({ quantity: 5, netAmount: 0.03, grossAmount: 0.03, repositoryName: "acme/app" }),
            item({ sku: "actions_macos", quantity: 2, netAmount: 0, grossAmount: 0.124 }),
            item({ date: "2026-11-10T00:00:00Z" }),
            item({ product: "packages", unitType: "GigabyteHours" }),
            item({ repositoryName: "other" }),
          ],
        },
      },
    ]);
    const client = createGithubClient({ token: "t", fetch: fake.fetch });
    const result = await getBillingUsage({ client, account: { kind: "org", name: "acme" }, repositories: ["acme/app"], from, to });
    expect(result).toEqual({
      ok: true,
      byRepository: {
        "acme/app": [
          { sku: "actions_linux", minutes: 15, grossUsd: 0.09, netUsd: 0.09 },
          { sku: "actions_macos", minutes: 2, grossUsd: 0.124, netUsd: 0 },
        ],
      },
    });
    expect(fake.requests[0]?.url.searchParams.get("month")).toBe("11");
  });

  it("asks every month the period touches", async () => {
    const fake = createFakeGithub([{ match: () => true, body: { usageItems: [] } }]);
    const client = createGithubClient({ token: "t", fetch: fake.fetch });
    await getBillingUsage({ client, account: { kind: "user", name: "someone" }, repositories: ["someone/app"], from: new Date("2026-12-28T00:00:00Z"), to: new Date("2027-01-04T00:00:00Z") });
    expect(fake.requests.map((request) => `${request.url.pathname} ${String(request.url.searchParams.get("year"))}-${String(request.url.searchParams.get("month"))}`)).toEqual([
      "/users/someone/settings/billing/usage 2026-12",
      "/users/someone/settings/billing/usage 2027-1",
    ]);
  });

  it("returns a refusal as a value", async () => {
    const fake = createFakeGithub([{ match: () => true, status: 403, body: { message: "Resource not accessible by integration" } }]);
    const client = createGithubClient({ token: "t", fetch: fake.fetch });
    const result = await getBillingUsage({ client, account: { kind: "org", name: "acme" }, repositories: ["acme/app"], from, to });
    expect(result).toEqual({ ok: false, error: "billing usage of org:acme unavailable: GET /organizations/acme/settings/billing/usage answered 403: Resource not accessible by integration" });
  });
});
