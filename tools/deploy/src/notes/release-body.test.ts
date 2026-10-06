import { describe, expect, it } from "vitest";
import { readReleaseSection, RELEASE_SECTION_CLOSE, RELEASE_SECTION_OPEN, writeReleaseSection } from "./release-body.js";

const OWNER = "First release with the new pipeline.\n\n| ID | Item |\n| --- | --- |\n| DF-1 | parity |";

describe("release body section", () => {
  it("appends the section under the owner's text and replaces it in place on the next run", () => {
    const first = writeReleaseSection(OWNER, "## v1 (2026-10-06)\n\nfirst");
    expect(first).toBe(`${OWNER}\n\n${RELEASE_SECTION_OPEN}\n## v1 (2026-10-06)\n\nfirst\n${RELEASE_SECTION_CLOSE}\n`);
    expect(readReleaseSection(first)).toBe("## v1 (2026-10-06)\n\nfirst");

    const second = writeReleaseSection(first, "second");
    expect(readReleaseSection(second)).toBe("second");
    expect(second.split(RELEASE_SECTION_OPEN)).toHaveLength(2);
    expect(second.startsWith(OWNER)).toBe(true);
  });

  it("keeps the text after the section", () => {
    const body = `above\n\n${RELEASE_SECTION_OPEN}\nold\n${RELEASE_SECTION_CLOSE}\n\nbelow, by hand`;
    expect(writeReleaseSection(body, "new")).toBe(`above\n\n${RELEASE_SECTION_OPEN}\nnew\n${RELEASE_SECTION_CLOSE}\n\nbelow, by hand`);
  });

  it("writes the section alone into an empty body", () => {
    expect(writeReleaseSection("", "report\n")).toBe(`${RELEASE_SECTION_OPEN}\nreport\n${RELEASE_SECTION_CLOSE}\n`);
    expect(writeReleaseSection("  \n", "report")).toBe(`${RELEASE_SECTION_OPEN}\nreport\n${RELEASE_SECTION_CLOSE}\n`);
  });

  it("reads no section from a body without one or with an opening marker only", () => {
    expect(readReleaseSection(OWNER)).toBeNull();
    expect(readReleaseSection(`${RELEASE_SECTION_OPEN}\nhalf`)).toBeNull();
    expect(readReleaseSection(`${RELEASE_SECTION_CLOSE}\n${RELEASE_SECTION_OPEN}`)).toBeNull();
  });

  it("appends a new section when only an opening marker is there, leaving the stray marker as text", () => {
    const body = `${RELEASE_SECTION_OPEN}\nhalf`;
    expect(writeReleaseSection(body, "r")).toBe(`${body}\n\n${RELEASE_SECTION_OPEN}\nr\n${RELEASE_SECTION_CLOSE}\n`);
  });
});
