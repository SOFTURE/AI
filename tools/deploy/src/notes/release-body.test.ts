import { describe, expect, it } from "vitest";
import {
  getSectionMarkers,
  readReleaseSection,
  readSection,
  RELEASE_SECTION_CLOSE,
  RELEASE_SECTION_OPEN,
  writeReleaseSection,
  writeSection,
} from "./release-body.js";

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

  it("keeps the sections in their fixed order whatever order they are written in", () => {
    const [notes, status, deployments] = (["release-notes", "status", "deployments"] as const).map((key) => getSectionMarkers(key).open);
    const reversed = writeSection(writeSection(writeSection(OWNER, "deployments", "d"), "status", "s"), "release-notes", "n");
    const positions = [notes, status, deployments].map((marker) => reversed.indexOf(marker ?? ""));
    expect(positions.every((position) => position > OWNER.length)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    expect(reversed.startsWith(OWNER)).toBe(true);
    expect(readSection(reversed, "status")).toBe("s");
    expect(readSection(reversed, "release-notes")).toBe("n");
  });

  it("names the release-notes markers as before (DF-1)", () => {
    expect(getSectionMarkers("release-notes")).toEqual({ open: RELEASE_SECTION_OPEN, close: RELEASE_SECTION_CLOSE });
    expect(RELEASE_SECTION_OPEN).toBe("<!-- softure-deploy:release-notes -->");
  });
});
