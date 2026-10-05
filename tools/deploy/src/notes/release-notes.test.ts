import { describe, expect, it } from "vitest";
import { deployMessages } from "../messages/index.js";
import type { ReleaseEntry } from "./release-entries.js";
import { formatReleaseNotes } from "./release-notes.js";

const SHA = "0123456789abcdef0123456789abcdef01234567";
const ENTRIES: ReleaseEntry[] = [
  { kind: "pull-request", number: 12, title: "Trial ends at midnight", sha: SHA },
  { kind: "commit", subject: "fix: typo in the footer", sha: SHA },
  { kind: "pull-request", number: 11, title: "Export to CSV", sha: SHA },
];
const REPO = "https://github.com/acme/app";

describe("formatReleaseNotes", () => {
  it("lists pull requests and other commits with links and a full diff link", () => {
    const notes = formatReleaseNotes({
      entries: ENTRIES,
      from: "v1.1.0",
      to: "v1.2.0",
      date: "2026-10-05",
      repoUrl: REPO,
      messages: deployMessages.en,
    });
    expect(notes).toBe(
      [
        "## v1.2.0 (2026-10-05)",
        "",
        "Changes since v1.1.0: 2 pull requests, 1 other commits.",
        "",
        "### Pull requests",
        "",
        `- Trial ends at midnight ([#12](${REPO}/pull/12))`,
        `- Export to CSV ([#11](${REPO}/pull/11))`,
        "",
        "### Other commits",
        "",
        `- fix: typo in the footer ([\`0123456\`](${REPO}/commit/${SHA}))`,
        "",
        `[Full diff](${REPO}/compare/v1.1.0...v1.2.0)`,
        "",
      ].join("\n"),
    );
  });

  it("writes plain numbers and short SHAs without a repository URL, in Polish", () => {
    const notes = formatReleaseNotes({
      entries: ENTRIES,
      from: "v1.1.0",
      to: "v1.2.0",
      date: "2026-10-05",
      repoUrl: null,
      messages: deployMessages.pl,
    });
    expect(notes).toContain("- Trial ends at midnight (#12)\n");
    expect(notes).toContain("- fix: typo in the footer (`0123456`)\n");
    expect(notes).toContain(deployMessages.pl.releaseNotes.pullRequests);
    expect(notes).not.toContain("compare");
  });

  it("says a first release starts at the first commit and leaves out the diff link", () => {
    const notes = formatReleaseNotes({
      entries: [ENTRIES[0] as ReleaseEntry],
      from: null,
      to: "v0.1.0",
      date: "2026-10-05",
      repoUrl: REPO,
      messages: deployMessages.en,
    });
    expect(notes).toContain("Changes from the first commit: 1 pull requests, 0 other commits.\n");
    expect(notes).not.toContain("### Other commits");
    expect(notes).not.toContain("compare");
  });

  it("says when nothing changed", () => {
    const notes = formatReleaseNotes({
      entries: [],
      from: "v1.1.0",
      to: "v1.1.1",
      date: "2026-10-05",
      repoUrl: REPO,
      messages: deployMessages.en,
    });
    expect(notes).toBe("## v1.1.1 (2026-10-05)\n\nNo changes since v1.1.0.\n");
  });
});
