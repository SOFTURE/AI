// The "Repository layout" block of the root README is the catalogue of packages: every workspace package under a
// group folder has its line there, and every line names a folder that exists. A new package is covered by being
// created, so its README line cannot be forgotten.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { findWorkspaces } from "../../scripts/build-workspaces.mjs";
import { REPO_ROOT } from "./repo-files.js";

const CATALOGUED_GROUPS = ["foundation", "modules", "tools", "themes"];
// The themes group ends with a placeholder line for the themes still to come.
const PLACEHOLDER_ENTRIES = new Set(["themes/theme-<name>"]);

/** `<group>/<name>` for every package line of the README's first fenced block under `## Repository layout`. */
function readLayoutEntries(readme: string): string[] {
  const section = readme.split(/^## Repository layout$/m)[1] ?? "";
  const block = section.match(/^```\n([\s\S]*?)^```$/m)?.[1] ?? "";
  const entries: string[] = [];
  let group: string | null = null;
  for (const line of block.split("\n")) {
    const groupMatch = line.match(/^([a-z][\w-]*)\/(\s|$)/);
    if (groupMatch) {
      group = groupMatch[1] ?? null;
      continue;
    }
    const entryMatch = line.match(/^ {2}(\S+)\/(\s|$)/);
    if (group && entryMatch) entries.push(`${group}/${entryMatch[1] ?? ""}`);
  }
  return entries;
}

const readme = readFileSync(join(REPO_ROOT, "README.md"), "utf8");
const listed = readLayoutEntries(readme);
const cataloguedPackages = findWorkspaces(REPO_ROOT)
  .map((pkg) => pkg.dir)
  .filter((dir) => CATALOGUED_GROUPS.includes(dir.split("/")[0] ?? ""));

describe("README repository layout", () => {
  it("reads the layout block (a parse that finds nothing would pass every check below)", () => {
    expect(listed).toContain("foundation/core");
    expect(listed).toContain("modules/auth");
  });

  it("lists every workspace package under its group", () => {
    expect(cataloguedPackages.filter((dir) => !listed.includes(dir))).toEqual([]);
  });

  it("lists only folders that exist", () => {
    const missing = listed.filter((entry) => !PLACEHOLDER_ENTRIES.has(entry) && !existsSync(join(REPO_ROOT, entry)));
    expect(missing).toEqual([]);
  });
});
