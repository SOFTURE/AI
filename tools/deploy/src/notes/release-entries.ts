import type { GitCommit } from "./git-log.js";

/** One line of the release report: a merged pull request or a commit made straight on the branch. */
export type ReleaseEntry =
  | { kind: "pull-request"; number: number; title: string; sha: string }
  | { kind: "commit"; subject: string; sha: string };

// GitHub's merge button: the title is the first line of the body.
const GITHUB_MERGE = /^Merge pull request #(\d+) from (\S+)/;
// A squash merge, and merge commits that keep the title: `<title> (#12)`.
const NUMBER_SUFFIX = /^(.*\S)\s+\(#(\d+)\)$/;
// Merge commits written as `Merge <branch>: <title> (#12)` (SOFTURE's own merges).
const MERGE_PREFIX = /^Merge [^:]+:\s+/;
// Syncing a branch with its base adds nothing to a release.
const SYNC_MERGE = /^Merge (?:branch|remote-tracking branch) /;

function toEntry(commit: GitCommit): ReleaseEntry | null {
  const githubMerge = GITHUB_MERGE.exec(commit.subject);
  if (githubMerge) {
    const title = commit.body.split("\n").find((line) => line.trim() !== "")?.trim() ?? githubMerge[2] ?? "";
    return { kind: "pull-request", number: Number(githubMerge[1]), title, sha: commit.sha };
  }
  const numbered = NUMBER_SUFFIX.exec(commit.subject);
  if (numbered) {
    const title = (numbered[1] ?? "").replace(MERGE_PREFIX, "");
    return { kind: "pull-request", number: Number(numbered[2]), title, sha: commit.sha };
  }
  if (SYNC_MERGE.test(commit.subject)) return null;
  return { kind: "commit", subject: commit.subject, sha: commit.sha };
}

/** Report lines in `git log` order (newest first); base syncs are dropped. */
export function toReleaseEntries(commits: GitCommit[]): ReleaseEntry[] {
  return commits.map(toEntry).filter((entry) => entry !== null);
}
