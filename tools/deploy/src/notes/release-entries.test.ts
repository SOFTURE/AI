import { describe, expect, it } from "vitest";
import { toReleaseEntries } from "./release-entries.js";

const commit = (subject: string, body = "", sha = "f".repeat(40)) => ({ sha, subject, body });

describe("toReleaseEntries", () => {
  it("reads the title of a GitHub merge from the body", () => {
    expect(toReleaseEntries([commit("Merge pull request #42 from owner/feature-x", "\nAdd the export button\n\nDetails")])).toEqual([
      { kind: "pull-request", number: 42, title: "Add the export button", sha: "f".repeat(40) },
    ]);
  });

  it("falls back to the branch when a GitHub merge has no body", () => {
    expect(toReleaseEntries([commit("Merge pull request #7 from owner/fix-login")])).toEqual([
      { kind: "pull-request", number: 7, title: "owner/fix-login", sha: "f".repeat(40) },
    ]);
  });

  it("reads a squash merge and a SOFTURE merge by their number suffix", () => {
    expect(
      toReleaseEntries([
        commit("feat(billing): trial ends at midnight (#12)"),
        commit("Merge roadmap promotion: deploy is the main roadmap (#106)"),
      ]),
    ).toEqual([
      { kind: "pull-request", number: 12, title: "feat(billing): trial ends at midnight", sha: "f".repeat(40) },
      { kind: "pull-request", number: 106, title: "deploy is the main roadmap", sha: "f".repeat(40) },
    ]);
  });

  it("keeps a direct commit and drops a base sync merge", () => {
    expect(
      toReleaseEntries([commit("fix: typo in the footer"), commit("Merge branch 'master' into feature"), commit("Merge remote-tracking branch 'origin/master'")]),
    ).toEqual([{ kind: "commit", subject: "fix: typo in the footer", sha: "f".repeat(40) }]);
  });
});
