import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/** Absolute path of the repository root (this file lives in `tests/repo/`). */
export const REPO_ROOT = fileURLToPath(new URL("../../", import.meta.url));

/**
 * Every file of the repository as repo-relative POSIX paths: tracked files plus untracked files
 * that are not git-ignored. Untracked files count, so a change folder or a document written
 * before its first commit is already checked by the gates that run before that commit; ignored
 * files do not, so a link to a local-only file fails here as it would in CI. Files deleted from
 * the working tree but still in the index are left out.
 */
export function listRepoFiles(): string[] {
  const output = execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
  const paths = output.split("\0").filter((path) => path.length > 0);
  return [...new Set(paths)].filter((path) => existsSync(join(REPO_ROOT, path)));
}
