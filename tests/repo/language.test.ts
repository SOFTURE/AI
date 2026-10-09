// The language gate over the whole repository; the gate itself is tested in tools/config.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { checkFiles } from "../../tools/config/src/language/index.js";
import { listRepoFiles, REPO_ROOT } from "./repo-files.js";

function readRepoText(path: string): string | null {
  try {
    return readFileSync(join(REPO_ROOT, path), "utf8");
  } catch {
    // A folder (a git submodule) or a file removed while the suite runs: nothing to check.
    return null;
  }
}

describe("the repository", () => {
  it("has no Polish text in any file outside message dictionaries and pl/ folders", () => {
    expect(checkFiles(listRepoFiles(), readRepoText)).toEqual([]);
  });
});
