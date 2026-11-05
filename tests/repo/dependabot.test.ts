import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { listRepoFiles, REPO_ROOT } from "./repo-files.js";

// Dependabot's configuration (LT-4). Dependabot reports a broken file only in the repository's Insights tab, so a
// directory that moved or a new Dockerfile or composite action that is not covered would go unnoticed; this test
// fails instead. Every entry is grouped and limited, because every pull request runs the full CI.

interface Group {
  "applies-to"?: string;
  patterns?: string[];
  "update-types"?: string[];
}

interface Update {
  "package-ecosystem": string;
  directory?: string;
  directories?: string[];
  schedule: { interval: string };
  "open-pull-requests-limit"?: number;
  "commit-message"?: { prefix?: string };
  groups?: Record<string, Group>;
  ignore?: { "dependency-name": string; "update-types"?: string[] }[];
}

interface Config {
  version: number;
  updates: Update[];
}

const CONFIG = parse(readFileSync(join(REPO_ROOT, ".github/dependabot.yml"), "utf8")) as Config;

function getUpdate(ecosystem: string): Update {
  const update = CONFIG.updates.find((candidate) => candidate["package-ecosystem"] === ecosystem);
  if (!update) throw new Error(`dependabot.yml has no ${ecosystem} entry`);
  return update;
}

function getDirectories(update: Update): string[] {
  return update.directories ?? (update.directory === undefined ? [] : [update.directory]);
}

/** Expands a Dependabot directory (`/`, `/a/b`, `/a/*`) to the repo-relative folders it names. */
function expandDirectory(directory: string): string[] {
  const relative = directory.replace(/^\/+/, "");
  if (!relative.endsWith("/*")) return [relative === "" ? "." : relative];
  const parent = relative.slice(0, -2);
  return readdirSync(join(REPO_ROOT, parent))
    .filter((name) => statSync(join(REPO_ROOT, parent, name)).isDirectory())
    .map((name) => `${parent}/${name}`);
}

function getCoveredFolders(ecosystem: string): string[] {
  return getDirectories(getUpdate(ecosystem)).flatMap(expandDirectory);
}

describe(".github/dependabot.yml", () => {
  it("is a version 2 file with one entry each for npm, GitHub Actions and Docker", () => {
    expect(CONFIG.version).toBe(2);
    expect(CONFIG.updates.map((update) => update["package-ecosystem"]).sort()).toEqual([
      "docker",
      "github-actions",
      "npm",
    ]);
  });

  it("names only folders that exist", () => {
    for (const update of CONFIG.updates) {
      for (const directory of getDirectories(update)) {
        const folders = expandDirectory(directory);
        expect(folders.length, `${update["package-ecosystem"]} ${directory}`).toBeGreaterThan(0);
        for (const folder of folders) expect(existsSync(join(REPO_ROOT, folder)), folder).toBe(true);
      }
    }
  });

  it("updates npm from the root, where the one lockfile is, and leaves the @softure-ai packages alone", () => {
    const npm = getUpdate("npm");
    expect(getDirectories(npm)).toEqual(["/"]);
    expect(existsSync(join(REPO_ROOT, "package-lock.json"))).toBe(true);
    expect(npm.ignore?.map((rule) => rule["dependency-name"])).toContain("@softure-ai/*");
  });

  it("groups npm minor and patch updates, and security updates, into one pull request each", () => {
    const groups = Object.values(getUpdate("npm").groups ?? {});
    expect(groups).toContainEqual({ "applies-to": "version-updates", "update-types": ["minor", "patch"] });
    expect(groups).toContainEqual({ "applies-to": "security-updates", patterns: ["*"] });
  });

  it("covers the workflows and every composite action", () => {
    const covered = getCoveredFolders("github-actions");
    expect(covered).toContain(".");
    const actions = listRepoFiles()
      .filter((path) => /^\.github\/actions\/[^/]+\/action\.ya?ml$/.test(path))
      .map((path) => dirname(path));
    expect(actions.length).toBeGreaterThan(0);
    for (const action of actions) expect(covered, action).toContain(action);
  });

  it("covers every Dockerfile in the tree, and no template", () => {
    const covered = getCoveredFolders("docker");
    const dockerfiles = listRepoFiles().filter((path) => /dockerfile$/i.test(path));
    expect(dockerfiles.length).toBeGreaterThan(0);
    for (const dockerfile of dockerfiles) expect(covered, dockerfile).toContain(dirname(dockerfile));
    expect(covered.some((folder) => folder.includes("templates"))).toBe(false);
  });

  it("keeps every entry grouped, limited, scheduled at most weekly and committed as chore(deps)", () => {
    for (const update of CONFIG.updates) {
      const name = update["package-ecosystem"];
      expect(Object.keys(update.groups ?? {}).length, name).toBeGreaterThan(0);
      expect(update["open-pull-requests-limit"], name).toBeGreaterThan(0);
      expect(update["open-pull-requests-limit"], name).toBeLessThanOrEqual(3);
      expect(["weekly", "monthly"], name).toContain(update.schedule.interval);
      expect(update["commit-message"]?.prefix, name).toBe("chore(deps)");
    }
  });

  it("leaves major Docker base image updates out", () => {
    expect(getUpdate("docker").ignore).toContainEqual({
      "dependency-name": "*",
      "update-types": ["version-update:semver-major"],
    });
  });
});
