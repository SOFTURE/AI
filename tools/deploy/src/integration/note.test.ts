import { describe, expect, it } from "vitest";
import { formatIntegrationNote, parseIntegrationNote, type IntegrationNote } from "./note.js";

const NOTE: IntegrationNote = {
  version: 1,
  result: "red",
  sha: "a".repeat(40),
  name: "invoice-pdf",
  ref: "refs/heads/integration/invoice-pdf",
  passed: 118,
  total: 120,
  red: ["checkout › pays by card", "export › writes the PDF"],
  run: "https://github.com/acme/app/actions/runs/7",
  finishedAt: "2026-10-08T09:30:00Z",
};

describe("the integration note", () => {
  it("reads back what it writes", () => {
    expect(parseIntegrationNote(formatIntegrationNote(NOTE))).toEqual({ ok: true, note: NOTE });
  });

  it("accepts unknown counts and no run URL", () => {
    const note = { ...NOTE, result: "green", passed: null, total: null, red: [], run: null };
    expect(parseIntegrationNote(JSON.stringify(note))).toEqual({ ok: true, note });
  });

  it("reads back the flaky tests of a note that has them", () => {
    const note = { ...NOTE, flaky: ["checkout › pays by transfer"] };
    expect(parseIntegrationNote(formatIntegrationNote(note))).toEqual({ ok: true, note });
  });

  it("writes no flaky key without flaky tests, so the reader of 0.1.7 still reads the note", () => {
    expect(JSON.parse(formatIntegrationNote({ ...NOTE, flaky: [] }))).not.toHaveProperty("flaky");
  });

  it("refuses text that is not JSON", () => {
    expect(parseIntegrationNote("integration: green")).toEqual({ ok: false, problem: "the note is not JSON" });
  });

  it("refuses a note of another shape, naming the field", () => {
    expect(parseIntegrationNote(JSON.stringify({ ...NOTE, result: "yellow" }))).toMatchObject({
      ok: false,
      problem: expect.stringMatching(/^result: /) as unknown,
    });
    expect(parseIntegrationNote(JSON.stringify({ ...NOTE, version: 2 }))).toMatchObject({ ok: false });
    expect(parseIntegrationNote(JSON.stringify({ ...NOTE, run: "http://example.com" }))).toMatchObject({ ok: false });
  });

  it("writes one line of JSON ending with a newline", () => {
    const text = formatIntegrationNote(NOTE);
    expect(text.endsWith("\n")).toBe(true);
    expect(text.trimEnd().includes("\n")).toBe(false);
  });
});
