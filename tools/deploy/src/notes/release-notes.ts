import { formatMessage, type DeployMessages } from "../messages/index.js";
import type { ReleaseEntry } from "./release-entries.js";
import type { RoadmapItem } from "./roadmap-items.js";

export interface ReleaseNotesOptions {
  entries: ReleaseEntry[];
  /** The previous tag; null for a first release (the range starts at the first commit). */
  from: string | null;
  to: string;
  /** Commit date of `to`, YYYY-MM-DD. */
  date: string;
  /** `https://github.com/<owner>/<repo>`; without it the report has numbers and short SHAs, no links. */
  repoUrl: string | null;
  messages: DeployMessages;
  /** Roadmap items the release ships (`selectShippingItems`); a table after the summary when there is one. */
  roadmapItems?: readonly RoadmapItem[];
}

const SHORT_SHA_LENGTH = 7;

function formatPullRequest(entry: Extract<ReleaseEntry, { kind: "pull-request" }>, repoUrl: string | null): string {
  const reference = repoUrl === null ? `#${entry.number}` : `[#${entry.number}](${repoUrl}/pull/${entry.number})`;
  return `- ${entry.title} (${reference})`;
}

function formatCommit(entry: Extract<ReleaseEntry, { kind: "commit" }>, repoUrl: string | null): string {
  const shortSha = `\`${entry.sha.slice(0, SHORT_SHA_LENGTH)}\``;
  const reference = repoUrl === null ? shortSha : `[${shortSha}](${repoUrl}/commit/${entry.sha})`;
  return `- ${entry.subject} (${reference})`;
}

function formatRoadmapItems(items: readonly RoadmapItem[], copy: DeployMessages["releaseNotes"]): string[] {
  if (items.length === 0) return [];
  return [
    "",
    `### ${copy.roadmapItems}`,
    "",
    `| ${copy.roadmapId} | ${copy.roadmapChange} | ${copy.roadmapOutcome} |`,
    "| --- | --- | --- |",
    // The outcome is the roadmap's own cell, so a `\|` inside it is already escaped.
    ...items.map((item) => `| **${item.id}** | \`${item.changeId}\` | ${item.outcome} |`),
  ];
}

/** The release report in Markdown, ready for a GitHub Release body. */
export function formatReleaseNotes(options: ReleaseNotesOptions): string {
  const { entries, from, to, date, repoUrl, messages, roadmapItems = [] } = options;
  const copy = messages.releaseNotes;
  const lines = [`## ${formatMessage(copy.heading, { to, date })}`, ""];
  if (entries.length === 0) {
    lines.push(formatMessage(copy.empty, { from: from ?? "" }), ...formatRoadmapItems(roadmapItems, copy));
    return `${lines.join("\n")}\n`;
  }
  const pullRequests = entries.filter((entry) => entry.kind === "pull-request");
  const commits = entries.filter((entry) => entry.kind === "commit");
  const counts = { pullRequests: pullRequests.length, commits: commits.length };
  lines.push(
    from === null ? formatMessage(copy.summaryFromStart, counts) : formatMessage(copy.summary, { ...counts, from }),
    ...formatRoadmapItems(roadmapItems, copy),
  );
  if (pullRequests.length > 0) {
    lines.push("", `### ${copy.pullRequests}`, "", ...pullRequests.map((entry) => formatPullRequest(entry, repoUrl)));
  }
  if (commits.length > 0) {
    lines.push("", `### ${copy.commits}`, "", ...commits.map((entry) => formatCommit(entry, repoUrl)));
  }
  if (repoUrl !== null && from !== null) {
    lines.push("", `[${copy.fullDiff}](${repoUrl}/compare/${from}...${to})`);
  }
  return `${lines.join("\n")}\n`;
}
