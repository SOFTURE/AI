// @ts-check
// Bumps one package and tags it for release: `npm run release:version -- <package> <bump>`.
//
//   <package>  short name, e.g. `core` for @softure-ai/core
//   <bump>     patch | minor | major | prepatch | preminor | premajor | prerelease | x.y.z
//
// Owner only (`release.owner` in context/workflow.json): it runs `npm version` for the
// workspace, keeps `module.json` in step, commits `chore(release): <package>@<version>` and
// creates the annotated tag. It never pushes; pushing the tag starts the release workflow.
// See scripts/release/README.md.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import semver from "semver";
import { readReleasePackages } from "./pack.mjs";
import { checkInternalRanges, findReleasePackage } from "./release-rules.mjs";

const BUMPS = ["patch", "minor", "major", "prepatch", "preminor", "premajor", "prerelease"];
const VERSION_KEY = /"version"\s*:\s*"[^"]*"/g;

/**
 * The tag the release workflow listens to.
 * @param {string} shortName
 * @param {string} version
 * @returns {string}
 */
export function getReleaseTag(shortName, version) {
  return `${shortName}@${version}`;
}

/**
 * Object nesting depth at `index`, counting braces outside JSON strings.
 * @param {string} text
 * @param {number} index
 * @returns {number}
 */
function getDepthAt(text, index) {
  let depth = 0;
  let isInString = false;
  for (let position = 0; position < index; position += 1) {
    const char = text[position];
    if (isInString) {
      if (char === "\\") position += 1;
      else if (char === '"') isInString = false;
    } else if (char === '"') isInString = true;
    else if (char === "{" || char === "[") depth += 1;
    else if (char === "}" || char === "]") depth -= 1;
  }
  return depth;
}

/**
 * Sets the top-level `version` of a `module.json` text, leaving the rest of the file as it is.
 * @param {string} text
 * @param {string} version
 * @returns {{ ok: true, text: string } | { ok: false, reason: string }}
 */
export function setModuleVersion(text, version) {
  const match = [...text.matchAll(VERSION_KEY)].find((candidate) => getDepthAt(text, candidate.index) === 1);
  if (!match) return { ok: false, reason: `Updating module.json: no top-level "version" to set to ${version}` };
  const updated = `${text.slice(0, match.index)}"version": "${version}"${text.slice(match.index + match[0].length)}`;
  return { ok: true, text: updated };
}

/**
 * @param {string} message
 * @returns {never}
 */
function fail(message) {
  console.error(message);
  process.exit(1);
}

/**
 * @param {string} root
 * @param {string[]} args
 * @returns {string}
 */
function git(root, args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
}

function runCli() {
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const [shortName, bump] = process.argv.slice(2);
  if (!shortName || !bump) fail("Usage: npm run release:version -- <package> <patch|minor|major|prerelease|x.y.z>");
  if (!BUMPS.includes(bump) && semver.valid(bump) !== bump) {
    fail(`Bumping ${shortName}: "${bump}" is neither ${BUMPS.join(", ")} nor a version x.y.z`);
  }

  const packages = readReleasePackages(root);
  const found = findReleasePackage(packages, shortName);
  if (!found.ok) fail(found.reason);
  const { pkg } = found;
  if (pkg.manifest.private === true) fail(`Bumping ${pkg.name}: it is private and never released`);
  if (git(root, ["status", "--porcelain"]) !== "") fail(`Bumping ${pkg.name}: commit or stash your changes first`);

  const current = String(pkg.manifest.version);
  const version = BUMPS.includes(bump) ? semver.inc(current, /** @type {semver.ReleaseType} */ (bump)) : bump;
  if (!version || semver.lte(version, current)) fail(`Bumping ${pkg.name}: ${bump} from ${current} does not give a higher version`);
  const tag = getReleaseTag(shortName, version);

  // A dependent whose range rejects the new version would make npm fetch the package from the
  // registry instead of linking it, and fail every later release; stop before anything changes.
  const workspaceVersions = new Map(packages.map((candidate) => [candidate.name, String(candidate.manifest.version)]));
  workspaceVersions.set(pkg.name, version);
  const rangeProblems = packages.flatMap((candidate) =>
    checkInternalRanges(candidate.manifest, workspaceVersions).map((problem) => `${candidate.dir}: ${problem}`),
  );
  if (rangeProblems.length > 0) {
    fail(
      `Bumping ${pkg.name} to ${version} breaks dependents (nothing was changed):\n- ${rangeProblems.join("\n- ")}\n` +
        "Widen their ranges in a commit of their own, then bump again.",
    );
  }

  try {
    // Updates the workspace's package.json and the root lockfile; no git commit or tag of its own.
    execFileSync("npm", ["version", version, "-w", pkg.dir, "--no-git-tag-version"], { cwd: root, stdio: "inherit" });
  } catch {
    // npm printed its error above; the tree was clean, so restoring it loses nothing.
    git(root, ["checkout", "--", "."]);
    fail(`Bumping ${pkg.name} to ${version}: npm version failed (output above); the tree is restored`);
  }

  const files = [join(pkg.dir, "package.json"), "package-lock.json"];
  const modulePath = join(root, pkg.dir, "module.json");
  if (existsSync(modulePath)) {
    const updated = setModuleVersion(readFileSync(modulePath, "utf8"), version);
    if (!updated.ok) fail(updated.reason);
    writeFileSync(modulePath, updated.text);
    files.push(join(pkg.dir, "module.json"));
  }

  git(root, ["add", "--", ...files]);
  git(root, ["commit", "-m", `chore(release): ${tag}`]);
  git(root, ["tag", "-a", tag, "-m", tag]);
  const branch = git(root, ["branch", "--show-current"]);
  console.log(`\nTagged ${tag}. Start the release with:\n  git push origin ${branch} ${tag}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCli();
}
