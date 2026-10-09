// Legal documents declared with their change history: the version derived from the newest entry,
// the history newest first, the refusals, and the version in force at a day or an instant.
import type { SoftureConfig } from "@softure-ai/core";
import { privacy, type PrivacyOptionsInput } from "@softure-ai/privacy";
import { getDocumentVersionAt, getLegalDocument } from "@softure-ai/privacy/server";
import { describe, expect, it } from "vitest";
import { createConfig as createAppConfig } from "./support.js";

const TERMS_HISTORY = [
  { date: "2026-01-15", summary: "First version." },
  { date: "2026-10-01", summary: "Added the newsletter." },
  { date: "2026-06-01", summary: "Named the payment provider." },
];

function createConfig(documents: PrivacyOptionsInput["documents"]): SoftureConfig {
  return createAppConfig({ documents });
}

describe("a legal document declared with its history", () => {
  it("takes its version from the newest entry and lists the history newest first", () => {
    const config = createConfig([{ id: "terms", history: TERMS_HISTORY }]);
    expect(getLegalDocument(config, "terms")).toEqual({
      id: "terms",
      version: "2026-10-01",
      history: [
        { version: "2026-10-01", date: "2026-10-01", summary: "Added the newsletter." },
        { version: "2026-06-01", date: "2026-06-01", summary: "Named the payment provider." },
        { version: "2026-01-15", date: "2026-01-15", summary: "First version." },
      ],
    });
  });

  it("uses an entry's own version when it has one", () => {
    const config = createConfig([
      { id: "terms", history: [{ date: "2026-01-15", version: "1.0", summary: "First version." }, { date: "2026-10-01", version: "1.1", summary: "Added the newsletter." }] },
    ]);
    expect(getLegalDocument(config, "terms").version).toBe("1.1");
  });

  it("accepts a declared version that matches the newest entry", () => {
    const config = createConfig([{ id: "terms", version: "2026-10-01", history: TERMS_HISTORY }]);
    expect(getLegalDocument(config, "terms").version).toBe("2026-10-01");
  });

  it("keeps a document declared with a version alone, with no history", () => {
    expect(getLegalDocument(createConfig([{ id: "terms", version: "3" }]), "terms")).toEqual({ id: "terms", version: "3", history: [] });
  });

  it("refuses a version that disagrees with the history, and a history it cannot date, listing every problem", () => {
    expect(() =>
      privacy({
        documents: [
          { id: "terms", version: "2026-06-01", history: TERMS_HISTORY },
          { id: "privacy-policy", history: [{ date: "2026-02-30", summary: "First version." }, { date: "2026-03-01", summary: "" }] },
          { id: "cookies", history: [{ date: "2026-03-01", summary: "First." }, { date: "2026-03-01", summary: "Again." }] },
          { id: "imprint", history: [] },
          { id: "dpa" },
        ],
      }),
    ).toThrow(
      [
        'Invalid SOFTURE configuration in module "privacy":',
        '- options.documents.0.version: must be the newest history entry\'s version, "2026-10-01"',
        "- options.documents.1.history.0.date: must be a calendar day, YYYY-MM-DD",
        "- options.documents.1.history.1.summary: must say what changed",
        '- options.documents.2.history.1.date: "2026-03-01" is listed twice',
        "- options.documents.3.history: needs at least one entry, or leave it out and declare version",
        "- options.documents.4: needs version, history or both",
      ].join("\n"),
    );
  });
});

describe("getDocumentVersionAt", () => {
  const config = createConfig([
    { id: "terms", history: TERMS_HISTORY },
    { id: "imprint", version: "2" },
  ]);

  it("answers the version in force on a calendar day, the entry's own day included", () => {
    expect(getDocumentVersionAt(config, "terms", "2026-05-31")).toBe("2026-01-15");
    expect(getDocumentVersionAt(config, "terms", "2026-06-01")).toBe("2026-06-01");
    expect(getDocumentVersionAt(config, "terms", "2027-01-01")).toBe("2026-10-01");
  });

  it("reads an instant as the day in the config's time zone", () => {
    // The test app's zone is America/New_York: 03:30 UTC on 1 October is still 30 September there.
    expect(getDocumentVersionAt(config, "terms", new Date("2026-10-01T03:30:00Z"))).toBe("2026-06-01");
    expect(getDocumentVersionAt(config, "terms", new Date("2026-10-01T04:30:00Z"))).toBe("2026-10-01");
  });

  it("answers undefined before the first entry", () => {
    expect(getDocumentVersionAt(config, "terms", "2026-01-14")).toBeUndefined();
  });

  it("answers the only known version of a document without history", () => {
    expect(getDocumentVersionAt(config, "imprint", "2020-01-01")).toBe("2");
  });

  it("throws for an undeclared document and for a day it cannot read", () => {
    expect(() => getDocumentVersionAt(config, "cookies", "2026-10-01")).toThrow(/no legal document "cookies"/);
    expect(() => getDocumentVersionAt(config, "terms", "1 October 2026")).toThrow(/"1 October 2026" is not a calendar day/);
  });
});
