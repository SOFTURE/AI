import { describe, expect, it } from "vitest";
import type { CollectResult } from "../src/collect.js";
import { DEFAULT_PRICES } from "../src/prices.js";
import { buildReport, renderMarkdown, REPORT_MARKER } from "../src/report.js";
import { makeJob } from "./fixtures.js";

const FROM = new Date("2026-11-11T06:30:00Z");
const TO = new Date("2026-11-18T06:30:00Z");
const PRICE_OPTIONS = { prices: DEFAULT_PRICES, ubicloudPremium: false };

function collected(repository: string, overrides: Partial<CollectResult> = {}): CollectResult {
  return {
    repository,
    jobs: [
      makeJob({ seconds: 900, name: "unit and repository tests (1/4)", runId: 1 }),
      makeJob({ seconds: 300, name: "build", runId: 2, labels: ["ubicloud-standard-4"], runnerGroupName: "Default" }),
    ],
    partial: [],
    runs: { counted: 2, fromCache: 1, running: 1, skipped: 0 },
    cache: { version: 1, runs: {} },
    error: null,
    ...overrides,
  };
}

describe("buildReport", () => {
  it("sums repositories into totals and marks a partial repository", () => {
    const report = buildReport({
      collected: [collected("acme/app"), collected("acme/api", { partial: ["stopped at the rate limit"] }), collected("acme/gone", { jobs: [], error: "GET /repos/acme/gone/actions/runs answered 404: Not Found" })],
      from: FROM,
      to: TO,
      generatedAt: TO,
      priceOptions: PRICE_OPTIONS,
    });
    expect(report).toMatchObject({ schemaVersion: 1, partial: true, period: { from: FROM.toISOString(), to: TO.toISOString(), days: 7 } });
    expect(report.totals).toMatchObject({ minutes: 40, runs: 4, jobs: 4 });
    expect(report.totals.usd).toBeCloseTo(2 * (15 * 0.006 + 5 * 0.0025), 4);
    expect(report.totals.byProvider.ubicloud.minutes).toBe(10);
    expect(report.repositories.map((repository) => repository.repository)).toEqual(["acme/app", "acme/api", "acme/gone"]);
  });

  it("is complete when every repository was read in full, and carries a refused billing lookup as a note", () => {
    const complete = buildReport({ collected: [collected("acme/app")], from: FROM, to: TO, generatedAt: TO, priceOptions: PRICE_OPTIONS });
    expect(complete.partial).toBe(false);
    const refused = buildReport({ collected: [collected("acme/app")], from: FROM, to: TO, generatedAt: TO, priceOptions: PRICE_OPTIONS, billing: { error: "billing usage of org:acme unavailable: 403" } });
    expect(refused).toMatchObject({ partial: true, notes: ["billing usage of org:acme unavailable: 403"] });
  });

  it("attaches the billed SKUs to their repository", () => {
    const report = buildReport({
      collected: [collected("acme/app")],
      from: FROM,
      to: TO,
      generatedAt: TO,
      priceOptions: PRICE_OPTIONS,
      billing: { byRepository: { "acme/app": [{ sku: "actions_linux", minutes: 15, grossUsd: 0.09, netUsd: 0 }] } },
    });
    expect(report.repositories[0]?.billing).toEqual([{ sku: "actions_linux", minutes: 15, grossUsd: 0.09, netUsd: 0 }]);
  });
});

describe("renderMarkdown", () => {
  const report = buildReport({
    collected: [collected("acme/app"), collected("acme/gone", { jobs: [], error: "GET /repos/acme/gone/actions/runs answered 404: Not Found" })],
    from: FROM,
    to: TO,
    generatedAt: TO,
    priceOptions: PRICE_OPTIONS,
  });
  const markdown = renderMarkdown(report);

  it("opens with the marker, the period and the status", () => {
    expect(markdown.split("\n").slice(0, 5)).toEqual([
      REPORT_MARKER,
      "# CI usage report",
      "",
      "Period: 2026-11-11 06:30 to 2026-11-18 06:30 UTC (7 days). Generated 2026-11-18 06:30 UTC.",
      "Status: partial, some runs are not counted (see the notes of each repository).",
    ]);
  });

  it("writes the totals per repository and in all", () => {
    expect(markdown).toContain("| Repository | Minutes | Est. USD | GitHub-hosted | Ubicloud | Self-hosted | Runs |");
    expect(markdown).toContain("| acme/app | 20 | 0.10 | 15 | 5 | 0 | 2 |");
    expect(markdown).toContain("| acme/gone | — | — | 0 | 0 | 0 | 0 |");
    expect(markdown).toContain("| **Totals** | 20 | 0.10 | 15 | 5 | 0 | 2 |");
  });

  it("writes the workflows, the heaviest jobs, the longest jobs and the notes of a repository", () => {
    expect(markdown).toContain("| ci (`.github/workflows/ci.yml`) | 2 | 2 | 20 | 100.0% | 0.10 |");
    expect(markdown).toContain("| ci | unit and repository tests (1/4) | `ubuntu-latest` | 1 | 15 | 15 | 15 | 0.09 |");
    expect(markdown).toMatch(/- \[15 min\]\(https:\/\/github\.com\/acme\/app\/actions\/runs\/\d+\/job\/\d+\) ci \/ unit and repository tests \(1\/4\) on `ubuntu-latest`/);
    expect(markdown).toContain("- 1 runs were still running and are left out.");
    expect(markdown).toContain("- 1 of 2 runs came from the cache of earlier reports.");
    expect(markdown).toContain("Not read: GET /repos/acme/gone/actions/runs answered 404: Not Found");
  });

  it("escapes pipes in job names and ends with the price source", () => {
    const piped = renderMarkdown(buildReport({ collected: [collected("acme/app", { jobs: [makeJob({ name: "a | b", seconds: 60 })] })], from: FROM, to: TO, generatedAt: TO, priceOptions: { prices: DEFAULT_PRICES, ubicloudPremium: true } }));
    expect(piped).toContain("| ci | a \\| b |");
    expect(piped.trimEnd().split("\n").at(-1)).toBe(`Prices: ${DEFAULT_PRICES.source} (checked ${DEFAULT_PRICES.checkedOn}), Ubicloud priced as premium.`);
  });

  it("says when a repository had no finished runs", () => {
    const empty = renderMarkdown(buildReport({ collected: [collected("acme/app", { jobs: [], runs: { counted: 0, fromCache: 0, running: 0, skipped: 0 } })], from: FROM, to: TO, generatedAt: TO, priceOptions: PRICE_OPTIONS }));
    expect(empty).toContain("No finished runs in the period.");
    expect(empty).toContain("Status: complete.");
  });
});
