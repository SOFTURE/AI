// @ts-check
// The rules a package must pass before it is released: the tag, the manifest and the packed
// tarball. Pure functions; `pack.mjs` reads the files and runs them. See scripts/release/README.md.
import { posix } from "node:path";
import semver from "semver";

export const SCOPE = "@softure-ai";
export const REPOSITORY_URL = "git+https://github.com/SOFTURE/AI.git";

const TAG_PATTERN = /^([a-z0-9][a-z0-9-]*)@(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)$/;
const TAG_FORM = "<package>@x.y.z (e.g. core@0.1.0)";
const DEPENDENCY_FIELDS = ["dependencies", "peerDependencies", "optionalDependencies"];
// Sources and their compiled output: `x.test.ts`, `x.test.js`, `x.test.d.ts`, `x.test.jsx`, ….
const TEST_FILE_PATTERN = /(^|\/)tests\/|\.test\.(d\.)?[cm]?[jt]sx?$/;

/**
 * @typedef {{ ok: true, shortName: string, version: string, isPrerelease: boolean } | { ok: false, reason: string }} ParsedTag
 * @typedef {{ name: string, dir: string, manifest: Record<string, unknown> }} ReleasePackage
 * @typedef {{ ok: true, pkg: ReleasePackage } | { ok: false, reason: string }} FoundPackage
 * @typedef {{ path: string, sources: string[] }} SourceMap
 */

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Reads a release tag such as `core@0.1.0` or `auth@1.0.0-beta.1`.
 * @param {string} tag
 * @returns {ParsedTag}
 */
export function parseReleaseTag(tag) {
  const match = TAG_PATTERN.exec(tag);
  const shortName = match?.[1];
  const version = match?.[2];
  if (!shortName || !version || semver.valid(version) !== version) {
    return { ok: false, reason: `Reading release tag "${tag}": expected ${TAG_FORM}` };
  }
  return { ok: true, shortName, version, isPrerelease: semver.prerelease(version) !== null };
}

/**
 * Finds the workspace a tag releases: the one named `@softure-ai/<shortName>`.
 * @param {ReleasePackage[]} packages
 * @param {string} shortName
 * @returns {FoundPackage}
 */
export function findReleasePackage(packages, shortName) {
  const name = `${SCOPE}/${shortName}`;
  const pkg = packages.find((candidate) => candidate.name === name);
  if (pkg) return { ok: true, pkg };
  const known = packages.map((candidate) => candidate.name).join(", ");
  return { ok: false, reason: `Finding workspace ${name}: no such package (workspaces: ${known})` };
}

/**
 * Checks `repository` and `publishConfig`, the fields npm provenance and the scope depend on.
 * @param {Record<string, unknown>} manifest
 * @param {string} dir
 * @returns {string[]}
 */
function checkPublishFields(manifest, dir) {
  const problems = [];
  const { repository, publishConfig } = manifest;
  const isRepositoryValid =
    isRecord(repository) &&
    repository.type === "git" &&
    repository.url === REPOSITORY_URL &&
    repository.directory === dir;
  if (!isRepositoryValid) {
    problems.push(
      `repository must be { "type": "git", "url": "${REPOSITORY_URL}", "directory": "${dir}" } (npm provenance checks it), got ${JSON.stringify(repository)}`,
    );
  }
  if (!isRecord(publishConfig) || publishConfig.access !== "public" || publishConfig.provenance !== true) {
    problems.push(
      `publishConfig must be { "access": "public", "provenance": true }, got ${JSON.stringify(publishConfig)}`,
    );
  }
  return problems;
}

/**
 * Checks that `files` ships the build and the sources (for maps and the source condition), not tests.
 * @param {unknown} files
 * @returns {string[]}
 */
function checkFilesField(files) {
  const entries = Array.isArray(files) ? files.filter((entry) => typeof entry === "string") : [];
  const problems = [];
  for (const required of ["dist", "src"]) {
    if (!entries.includes(required)) problems.push(`files must include "${required}", got ${JSON.stringify(files)}`);
  }
  const testEntries = entries.filter((entry) => entry === "tests" || entry.startsWith("tests/"));
  if (testEntries.length > 0) problems.push(`files must not ship tests, got ${JSON.stringify(testEntries)}`);
  return problems;
}

/**
 * Checks that every `@softure-ai/*` dependency range accepts the version in the workspace, so a
 * workspace install links the local package instead of fetching another one from the registry.
 * @param {Record<string, unknown>} manifest
 * @param {Map<string, string>} workspaceVersions
 * @returns {string[]}
 */
export function checkInternalRanges(manifest, workspaceVersions) {
  return DEPENDENCY_FIELDS.flatMap((field) => {
    const dependencies = manifest[field];
    if (!isRecord(dependencies)) return [];
    return Object.entries(dependencies).flatMap(([name, range]) => {
      const workspaceVersion = workspaceVersions.get(name);
      if (workspaceVersion === undefined) return [];
      if (typeof range !== "string" || semver.validRange(range) === null || range.trim() === "*") {
        return [`${field}.${name} must be a version range such as "^${workspaceVersion}", got ${JSON.stringify(range)}`];
      }
      if (!semver.satisfies(workspaceVersion, range, { includePrerelease: true })) {
        return [`${field}.${name} range ${range} does not accept the workspace version ${workspaceVersion}`];
      }
      return [];
    });
  });
}

/**
 * Checks a package manifest against the release being made.
 * @param {{
 *   manifest: Record<string, unknown>,
 *   dir: string,
 *   version: string,
 *   moduleVersion: string | null,
 *   workspaceVersions: Map<string, string>,
 *   allowPrivate: boolean,
 * }} input `moduleVersion` is the `version` of `module.json`, or null when there is none;
 *   `allowPrivate` is true for dry runs.
 * @returns {string[]} problems, each naming the field and the values found
 */
export function checkManifest({ manifest, dir, version, moduleVersion, workspaceVersions, allowPrivate }) {
  const problems = [];
  if (manifest.private === true && !allowPrivate) {
    problems.push(`package.json has "private": true, so npm refuses to publish it`);
  }
  if (manifest.version !== version) {
    problems.push(`package.json has version ${String(manifest.version)}, the tag says ${version}`);
  }
  if (moduleVersion !== null && moduleVersion !== manifest.version) {
    problems.push(`module.json has version ${moduleVersion}, package.json has ${String(manifest.version)}`);
  }
  if (manifest.license !== "MIT") {
    problems.push(`license must be "MIT", got ${JSON.stringify(manifest.license)}`);
  }
  problems.push(...checkPublishFields(manifest, dir));
  problems.push(...checkFilesField(manifest.files));
  problems.push(...checkInternalRanges(manifest, workspaceVersions));
  return problems;
}

/**
 * Every `exports` target as [entry, condition, path], conditions nested at any depth.
 * @param {unknown} target
 * @param {string} entry
 * @param {string} condition
 * @returns {[string, string, string][]}
 */
function listExportTargets(target, entry, condition) {
  if (typeof target === "string") return [[entry, condition, target]];
  if (!isRecord(target)) return [];
  return Object.entries(target).flatMap(([key, child]) => listExportTargets(child, entry, key));
}

/**
 * Whether a target path (or a subpath pattern with one `*`) names at least one packed file.
 * @param {string[]} files
 * @param {string} target
 * @returns {boolean}
 */
function hasPackedTarget(files, target) {
  const path = posix.normalize(target);
  if (!path.includes("*")) return files.includes(path);
  const [prefix = "", suffix = ""] = path.split("*");
  return files.some((file) => file.length > prefix.length + suffix.length && file.startsWith(prefix) && file.endsWith(suffix));
}

/**
 * Checks the file list of a packed tarball (paths relative to the package root).
 * @param {{ manifest: Record<string, unknown>, files: string[], sourceMaps: SourceMap[] }} input
 *   `sourceMaps` holds the `sources` of every packed `.map` file.
 * @returns {string[]}
 */
export function checkPackedFiles({ manifest, files, sourceMaps }) {
  const packed = new Set(files);
  const problems = [];
  for (const required of ["package.json", "README.md", "LICENSE"]) {
    if (!packed.has(required)) problems.push(`the tarball has no ${required}`);
  }
  // A string or condition object is the root entry; an object keyed by subpaths lists entries.
  const { exports: exportsField } = manifest;
  const isSubpathMap = isRecord(exportsField) && Object.keys(exportsField).every((key) => key.startsWith("."));
  /** @type {[string, unknown][]} */
  const entries = isSubpathMap ? Object.entries(exportsField) : exportsField === undefined ? [] : [[".", exportsField]];
  for (const [entry, target] of entries) {
    for (const [, condition, path] of listExportTargets(target, entry, "default")) {
      if (!hasPackedTarget(files, path)) {
        problems.push(`exports "${entry}" ${condition} points at ${path}, which is not in the tarball`);
      }
    }
  }
  for (const field of ["main", "types"]) {
    const path = manifest[field];
    if (typeof path === "string" && !hasPackedTarget(files, path)) {
      problems.push(`${field} points at ${path}, which is not in the tarball`);
    }
  }
  for (const file of files) {
    if (TEST_FILE_PATTERN.test(file)) problems.push(`the tarball ships a test file: ${file}`);
  }
  for (const { path, sources } of sourceMaps) {
    for (const source of sources) {
      const file = posix.join(posix.dirname(path), source);
      if (!packed.has(file)) problems.push(`${path} maps to ${file}, which is not in the tarball`);
    }
  }
  return problems;
}
