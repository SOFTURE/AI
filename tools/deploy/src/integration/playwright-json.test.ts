import { describe, expect, it } from "vitest";
import { readPlaywrightJsonCounts } from "./playwright-json.js";

/** The parts of Playwright's JSON reporter output the reader uses, as Playwright 1.5x writes them. */
const REPORT = {
  config: { version: "1.56.0" },
  suites: [
    {
      title: "checkout.spec.ts",
      file: "checkout.spec.ts",
      specs: [
        { title: "pays by card", file: "checkout.spec.ts", tests: [{ projectName: "chromium", status: "expected", results: [] }] },
      ],
      suites: [
        {
          title: "refunds",
          file: "checkout.spec.ts",
          specs: [
            {
              title: "refunds a failed payment",
              tests: [
                { projectName: "chromium", status: "unexpected" },
                { projectName: "webkit", status: "flaky" },
              ],
            },
            { title: "is not ready", tests: [{ projectName: "chromium", status: "skipped" }] },
          ],
        },
      ],
    },
    { title: "export.spec.ts", specs: [{ title: "writes the PDF", tests: [{ projectName: "", status: "flaky" }] }] },
  ],
  stats: { expected: 1, unexpected: 1, flaky: 2, skipped: 1 },
};

describe("readPlaywrightJsonCounts", () => {
  it("counts every test of every project and names the red and the flaky ones", () => {
    expect(readPlaywrightJsonCounts(JSON.stringify(REPORT))).toEqual({
      ok: true,
      counts: {
        passed: 3,
        total: 4,
        red: ["[chromium] › checkout.spec.ts › refunds › refunds a failed payment"],
        flaky: ["[webkit] › checkout.spec.ts › refunds › refunds a failed payment", "export.spec.ts › writes the PDF"],
      },
    });
  });

  it("reads a report without suites as no tests", () => {
    expect(readPlaywrightJsonCounts(JSON.stringify({ suites: [] }))).toEqual({
      ok: true,
      counts: { passed: 0, total: 0, red: [], flaky: [] },
    });
  });

  it("returns a problem for text that is not JSON", () => {
    expect(readPlaywrightJsonCounts("<testsuites/>")).toEqual({ ok: false, problem: "the report is not JSON" });
  });

  it("returns a problem naming the field of a report of another shape", () => {
    expect(readPlaywrightJsonCounts(JSON.stringify({ tests: [] }))).toMatchObject({ ok: false, problem: expect.stringMatching(/^suites: /) as unknown });
    const badStatus = { suites: [{ title: "a", specs: [{ title: "b", tests: [{ status: "passed" }] }] }] };
    expect(readPlaywrightJsonCounts(JSON.stringify(badStatus))).toMatchObject({ ok: false, problem: expect.stringMatching(/status/) as unknown });
  });
});
