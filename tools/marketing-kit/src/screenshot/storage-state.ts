import { existsSync, readFileSync } from "node:fs";

/**
 * A Playwright storage state (`{ cookies, origins }`) restores a signed-in session for a screenshot. Checked before
 * the browser starts, so a missing or broken file is reported by name instead of as a browser error halfway through
 * the run. The file holds session cookies: its contents are never printed.
 */

export const STORAGE_STATE_HINT = "create it with your app's login script (context.storageState({ path })) or npx playwright codegen --save-storage=<file> <url>";

/** Null when the file looks like a storage state; otherwise what is wrong with it, without its contents. */
export function findStorageStateProblem(path: string): string | null {
  if (!existsSync(path)) return `the storage state ${path} does not exist; ${STORAGE_STATE_HINT}`;
  let data: unknown;
  try {
    data = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    // The parse error would quote the file, which holds a session; the path is enough to find it.
    return `the storage state ${path} is not JSON; ${STORAGE_STATE_HINT}`;
  }
  const isStorageState = typeof data === "object" && data !== null && Array.isArray((data as { cookies?: unknown }).cookies);
  if (!isStorageState) return `the storage state ${path} has no "cookies" list, so it is not a Playwright storage state; ${STORAGE_STATE_HINT}`;
  return null;
}
