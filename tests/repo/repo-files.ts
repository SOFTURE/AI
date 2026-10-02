import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

/** Absolute path of the repository root (this file lives in `tests/repo/`). */
export const REPO_ROOT = fileURLToPath(new URL("../../", import.meta.url));

/** Every file git tracks, as repo-relative POSIX paths. */
export function listTrackedFiles(): string[] {
  const output = execFileSync("git", ["ls-files", "-z"], { cwd: REPO_ROOT, encoding: "utf8" });
  return output.split("\0").filter((path) => path.length > 0);
}
