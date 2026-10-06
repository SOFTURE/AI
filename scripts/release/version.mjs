// @ts-check
// Bumps one package and tags it for release: `npm run release:version -- <package> <bump>`.
//
//   <package>  short name, e.g. `core` for @softure-ai/core
//   <bump>     patch | minor | major | prepatch | preminor | premajor | prerelease | x.y.z
//
// Owner only (`release.owner` in context/workflow.json): it runs `npm version` for the
// workspace, keeps `module.json` and the inline manifest of `src/index.ts` in step, commits
// `chore(release): <package>@<version>` and creates the annotated tag. It never pushes; pushing the tag starts the release workflow.
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
 * Indexes of the code characters of a TypeScript source: everything outside strings, template
 * literals and comments. Enough for the plain object literals of a module manifest.
 * @param {string} text
 * @returns {boolean[]}
 */
function markCode(text) {
  /** @type {boolean[]} */
  const isCode = Array.from({ length: text.length }, () => false);
  let position = 0;
  while (position < text.length) {
    const char = text[position];
    const next = text[position + 1];
    if (char === "/" && next === "/") {
      const end = text.indexOf("\n", position);
      position = end === -1 ? text.length : end;
    } else if (char === "/" && next === "*") {
      const end = text.indexOf("*/", position + 2);
      position = end === -1 ? text.length : end + 2;
    } else if (char === '"' || char === "'" || char === "`") {
      position += 1;
      while (position < text.length && text[position] !== char) position += text[position] === "\\" ? 2 : 1;
      position += 1;
    } else {
      isCode[position] = true;
      position += 1;
    }
  }
  return isCode;
}

const MANIFEST_KEY = /(?<![\w$])manifest\s*:\s*\{/g;
const INLINE_VERSION_KEY = /(?<![\w$])version\s*:\s*"[^"\\\n]*"/g;

/**
 * Sets the `version` of the inline `manifest: { ... }` object in a module's `src/index.ts`, leaving
 * the rest of the file as it is. Refuses a file with no manifest, several, or a manifest without
 * exactly one top-level `version`.
 * @param {string} text
 * @param {string} version
 * @returns {{ ok: true, text: string } | { ok: false, reason: string }}
 */
export function setInlineManifestVersion(text, version) {
  const isCode = markCode(text);
  const manifests = [...text.matchAll(MANIFEST_KEY)].filter((match) => isCode[match.index]);
  const [manifest] = manifests;
  if (!manifest) return { ok: false, reason: `Updating src/index.ts: no inline manifest to set to ${version}` };
  if (manifests.length > 1) {
    return { ok: false, reason: `Updating src/index.ts: ${manifests.length} inline manifests, expected one` };
  }

  const open = manifest.index + manifest[0].length - 1;
  let depth = 0;
  let close = text.length;
  /** @type {number[]} */
  const topLevelStarts = [];
  for (let position = open; position < text.length; position += 1) {
    if (!isCode[position]) continue;
    const char = text[position];
    if (char === "{" || char === "[" || char === "(") depth += 1;
    else if (char === "}" || char === "]" || char === ")") {
      depth -= 1;
      if (depth === 0) {
        close = position;
        break;
      }
    } else if (depth === 1 && char === "v") topLevelStarts.push(position);
  }

  const candidates = [...text.slice(0, close).matchAll(INLINE_VERSION_KEY)].filter((match) =>
    topLevelStarts.includes(match.index),
  );
  const [match] = candidates;
  if (candidates.length !== 1 || !match) {
    return { ok: false, reason: `Updating src/index.ts: the manifest has ${candidates.length} top-level "version" keys, expected one` };
  }
  const updated = `${text.slice(0, match.index)}version: "${version}"${text.slice(match.index + match[0].length)}`;
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

  // Every module repeats its version in the inline manifest of src/index.ts; read it before
  // anything changes, so a module the script cannot update is refused with a clean tree.
  const modulePath = join(root, pkg.dir, "module.json");
  const indexPath = join(root, pkg.dir, "src/index.ts");
  /** @type {string | null} */
  let indexText = null;
  if (existsSync(modulePath)) {
    if (!existsSync(indexPath)) fail(`Bumping ${pkg.name} (nothing was changed): it has module.json but no src/index.ts`);
    const inline = setInlineManifestVersion(readFileSync(indexPath, "utf8"), version);
    if (!inline.ok) fail(`Bumping ${pkg.name} (nothing was changed): ${inline.reason}`);
    indexText = inline.text;
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
  if (indexText !== null) {
    const updated = setModuleVersion(readFileSync(modulePath, "utf8"), version);
    if (!updated.ok) fail(updated.reason);
    writeFileSync(modulePath, updated.text);
    writeFileSync(indexPath, indexText);
    files.push(join(pkg.dir, "module.json"), join(pkg.dir, "src/index.ts"));
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
