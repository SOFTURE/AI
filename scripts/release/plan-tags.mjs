// @ts-check
// Plans the release tags of a dispatched release: `node scripts/release/plan-tags.mjs <all|package…>`.
//
// Prints one `<package>@<version>` tag per line, the version taken from the package's
// `package.json`, in dependency order. `auto-release.yml` creates the missing tags and starts
// `release.yml` on each. See scripts/release/README.md ("Release from Actions").
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getDependencyNames, orderWorkspaces } from "../build-workspaces.mjs";
import { readReleasePackages } from "./pack.mjs";
import { SCOPE } from "./release-rules.mjs";
import { getReleaseTag } from "./version.mjs";

const ALL = "all";
const SUBJECT = "Planning release tags";

/**
 * @typedef {import("./release-rules.mjs").ReleasePackage} ReleasePackage
 * @typedef {{ ok: true, tags: string[] } | { ok: false, reason: string }} TagPlan
 */

/**
 * The tags to release for a request: `all` (every public package) or package short names.
 * @param {ReleasePackage[]} packages
 * @param {string[]} request
 * @returns {TagPlan}
 */
export function planReleaseTags(packages, request) {
  if (request.length === 0) return { ok: false, reason: `${SUBJECT}: name packages or "${ALL}"` };
  const isAll = request.includes(ALL);
  const requested = new Set(request.map((shortName) => `${SCOPE}/${shortName}`));
  if (!isAll) {
    for (const name of requested) {
      const pkg = packages.find((candidate) => candidate.name === name);
      if (!pkg) return { ok: false, reason: `${SUBJECT}: no workspace package "${name}"` };
      if (pkg.manifest.private === true) return { ok: false, reason: `${SUBJECT}: ${name} is private and never released` };
    }
  }
  const ordered = orderWorkspaces(
    packages.map((pkg) => ({ name: pkg.name, dir: pkg.dir, dependencyNames: getDependencyNames(pkg.manifest) })),
  );
  const tags = ordered.flatMap(({ name }) => {
    const pkg = packages.find((candidate) => candidate.name === name);
    if (!pkg || pkg.manifest.private === true) return [];
    if (!isAll && !requested.has(name)) return [];
    return [getReleaseTag(name.slice(SCOPE.length + 1), String(pkg.manifest.version))];
  });
  return { ok: true, tags };
}

function runCli() {
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const request = process.argv.slice(2).flatMap((arg) => arg.split(/[\s,]+/)).filter((arg) => arg !== "");
  const plan = planReleaseTags(readReleasePackages(root), request);
  if (!plan.ok) {
    console.error(plan.reason);
    process.exit(1);
  }
  console.log(plan.tags.join("\n"));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCli();
}
