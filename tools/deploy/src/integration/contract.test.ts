import { describe, expect, it } from "vitest";
import { formatContractLines } from "./contract.js";
import type { IntegrationNote } from "./note.js";

const GREEN: IntegrationNote = {
  version: 1,
  result: "green",
  sha: "b".repeat(40),
  name: "invoice-pdf",
  ref: "refs/heads/integration/invoice-pdf",
  passed: 120,
  total: 120,
  red: [],
  run: "https://github.com/acme/app/actions/runs/8",
  finishedAt: "2026-10-08T09:30:00Z",
};

describe("formatContractLines", () => {
  it("prints the result, the counts and the run of a green note", () => {
    expect(formatContractLines(GREEN, null)).toBe(
      ["integration: green", "counts: 120/120", "run: https://github.com/acme/app/actions/runs/8", ""].join("\n"),
    );
  });

  it("prints every red test, and only the ones the main branch's result lacks as new-red", () => {
    const red = { ...GREEN, result: "red" as const, passed: 117, red: ["a › one", "b › two", "c › three"] };
    const main = { ...GREEN, sha: "c".repeat(40), result: "red" as const, red: ["b › two"] };
    expect(formatContractLines(red, main)).toBe(
      [
        "integration: red",
        "counts: 117/120",
        "run: https://github.com/acme/app/actions/runs/8",
        "red: a › one",
        "red: b › two",
        "red: c › three",
        "new-red: a › one",
        "new-red: c › three",
        "",
      ].join("\n"),
    );
  });

  it("prints no new-red line without a main-branch result, so every red counts as new", () => {
    const red = { ...GREEN, result: "red" as const, red: ["a › one"] };
    expect(formatContractLines(red, null)).not.toContain("new-red:");
  });

  it("prints one flaky line per test that passed only on a retry, after the new-red lines", () => {
    const red = { ...GREEN, result: "red" as const, passed: 119, red: ["a › one"], flaky: ["b › two", "c\nthree"] };
    expect(formatContractLines(red, { ...GREEN, sha: "c".repeat(40) })).toBe(
      [
        "integration: red",
        "counts: 119/120",
        "run: https://github.com/acme/app/actions/runs/8",
        "red: a › one",
        "new-red: a › one",
        "flaky: b › two",
        "flaky: c three",
        "",
      ].join("\n"),
    );
    expect(formatContractLines({ ...GREEN, flaky: ["b › two"] }, null)).toContain("integration: green\n");
  });

  it("leaves out the counts and the run when they are unknown", () => {
    expect(formatContractLines({ ...GREEN, passed: null, total: null, run: null }, null)).toBe("integration: green\n");
  });

  it("keeps a test name on one line", () => {
    const red = { ...GREEN, result: "red" as const, red: ["a\nb"] };
    expect(formatContractLines(red, null)).toContain("red: a b\n");
  });
});
