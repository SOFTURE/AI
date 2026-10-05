/**
 * Commits as `git log` prints them with {@link GIT_LOG_FORMAT}: fields split by the unit separator, records by the
 * record separator, so a subject or body can hold any printable text.
 */
export interface GitCommit {
  sha: string;
  subject: string;
  body: string;
}

const FIELD = "\x1f";
const RECORD = "\x1e";

export const GIT_LOG_FORMAT = "%H%x1f%s%x1f%b%x1e";

export function parseGitLog(raw: string): GitCommit[] {
  return raw
    .split(RECORD)
    .map((record) => record.replace(/^\n+/, ""))
    .filter((record) => record.trim() !== "")
    .map((record) => {
      const [sha = "", subject = "", body = ""] = record.split(FIELD);
      return { sha: sha.trim(), subject: subject.trim(), body: body.trim() };
    });
}
