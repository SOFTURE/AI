// @ts-check
// Packs workspace packages and checks the result: `npm run release:pack -- <options>`.
//
//   --tag <package>@x.y.z      release run: pack that package, refuse anything not publishable
//   --package <short name>     dry run of one package (private packages allowed)
//   --all                      dry run of every workspace package
//   --dry-run                  required with --package and --all
//   --out <dir>                where the tarballs go (required)
//
// Run `npm run build` first: the tarball ships `dist/`. In a release run with GITHUB_OUTPUT set,
// it writes `tarball`, `name`, `short-name`, `version`, `npm-tag` and `prerelease` for the
// release workflow. See scripts/release/README.md.
import { execFileSync } from "node:child_process";
import { appendFileSync, copyFileSync, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { findWorkspaces } from "../build-workspaces.mjs";
import { SCOPE, checkManifest, checkPackedFiles, findReleasePackage, parseReleaseTag } from "./release-rules.mjs";

/**
 * @typedef {import("./release-rules.mjs").ReleasePackage} ReleasePackage
 * @typedef {{ tarball: string, problems: string[] }} PackResult
 */

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Reads a JSON file into an untyped value; callers narrow what they use.
 * @param {string} path
 * @returns {unknown}
 */
function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

/**
 * Every workspace package with its manifest.
 * @param {string} root
 * @returns {ReleasePackage[]}
 */
export function readReleasePackages(root) {
  return findWorkspaces(root).map(({ name, dir }) => {
    const manifest = readJson(join(root, dir, "package.json"));
    if (!isRecord(manifest)) throw new Error(`Reading ${dir}/package.json: not a JSON object`);
    return { name, dir, manifest };
  });
}

/**
 * The `version` of the package's `module.json`, or null when it has none.
 * @param {string} packageDir absolute path
 * @returns {string | null}
 */
function readModuleVersion(packageDir) {
  const path = join(packageDir, "module.json");
  if (!existsSync(path)) return null;
  const moduleJson = readJson(path);
  return isRecord(moduleJson) ? String(moduleJson.version) : null;
}

/**
 * Runs `npm pack` for one workspace and returns the tarball path and its file list.
 * @param {string} root
 * @param {string} dir
 * @param {string} outDir absolute path
 * @returns {{ tarball: string, files: string[] }}
 */
function runNpmPack(root, dir, outDir) {
  const output = execFileSync("npm", ["pack", "--json", "--pack-destination", outDir, "-w", dir], {
    cwd: root,
    encoding: "utf8",
  });
  /** @type {unknown} */
  const parsed = JSON.parse(output);
  const result = Array.isArray(parsed) ? /** @type {unknown} */ (parsed[0]) : undefined;
  if (!isRecord(result) || typeof result.filename !== "string" || !Array.isArray(result.files)) {
    throw new Error(`Packing ${dir}: unexpected npm pack output`);
  }
  const files = result.files.flatMap((file) => (isRecord(file) && typeof file.path === "string" ? [file.path] : []));
  return { tarball: join(outDir, result.filename), files };
}

/**
 * The `sources` of every packed source map, read from the package folder (the tarball holds the same files).
 * @param {string} packageDir absolute path
 * @param {string[]} files
 * @returns {import("./release-rules.mjs").SourceMap[]}
 */
function readSourceMaps(packageDir, files) {
  return files
    .filter((file) => file.endsWith(".map"))
    .map((path) => {
      const map = readJson(join(packageDir, path));
      const sources = isRecord(map) && Array.isArray(map.sources) ? map.sources.map(String) : [];
      return { path, sources };
    });
}

/**
 * Packs one package with the repository LICENSE and checks the manifest and the tarball.
 * @param {{
 *   root: string,
 *   pkg: ReleasePackage,
 *   version: string,
 *   allowPrivate: boolean,
 *   outDir: string,
 *   workspaceVersions: Map<string, string>,
 * }} input `version` is the version being released (the tag's, or the manifest's in a dry run).
 * @returns {PackResult}
 */
export function packPackage({ root, pkg, version, allowPrivate, outDir, workspaceVersions }) {
  const packageDir = join(root, pkg.dir);
  const license = join(packageDir, "LICENSE");
  // MIT requires the license text in every copy; the root LICENSE is the single source.
  const isLicenseCopied = !existsSync(license);
  if (isLicenseCopied) copyFileSync(join(root, "LICENSE"), license);
  try {
    mkdirSync(outDir, { recursive: true });
    const { tarball, files } = runNpmPack(root, pkg.dir, outDir);
    const problems = [
      ...checkManifest({
        manifest: pkg.manifest,
        dir: pkg.dir,
        version,
        moduleVersion: readModuleVersion(packageDir),
        workspaceVersions,
        allowPrivate,
      }),
      ...checkPackedFiles({ manifest: pkg.manifest, files, sourceMaps: readSourceMaps(packageDir, files) }),
    ];
    return { tarball, problems };
  } finally {
    if (isLicenseCopied) rmSync(license, { force: true });
  }
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
 * Writes `key=value` lines for the next workflow steps when running on GitHub Actions.
 * @param {Record<string, string>} values
 */
function writeGitHubOutput(values) {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (!outputPath) return;
  appendFileSync(outputPath, Object.entries(values).map(([key, value]) => `${key}=${value}\n`).join(""));
}

function runCli() {
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const { values } = parseArgs({
    options: {
      tag: { type: "string" },
      package: { type: "string" },
      all: { type: "boolean", default: false },
      "dry-run": { type: "boolean", default: false },
      out: { type: "string" },
    },
  });
  if (!values.out) fail("Packing: --out <dir> is required");
  const modes = [values.tag !== undefined, values.package !== undefined, values.all].filter(Boolean).length;
  if (modes !== 1) fail("Packing: pass exactly one of --tag, --package or --all");
  if (values.tag !== undefined && values["dry-run"]) fail("Packing: --tag is a release run; use --package for a dry run");
  if (values.tag === undefined && !values["dry-run"]) fail("Packing: --package and --all need --dry-run");

  const packages = readReleasePackages(root);
  const workspaceVersions = new Map(packages.map((pkg) => [pkg.name, String(pkg.manifest.version)]));
  const outDir = resolve(values.out);

  if (values.tag !== undefined) {
    const tag = parseReleaseTag(values.tag);
    if (!tag.ok) fail(tag.reason);
    const found = findReleasePackage(packages, tag.shortName);
    if (!found.ok) fail(found.reason);
    const { tarball, problems } = packPackage({
      root,
      pkg: found.pkg,
      version: tag.version,
      allowPrivate: false,
      outDir,
      workspaceVersions,
    });
    if (problems.length > 0) fail(`Releasing ${values.tag} (${found.pkg.dir}):\n- ${problems.join("\n- ")}`);
    console.log(`ok ${found.pkg.name}@${tag.version} -> ${tarball}`);
    writeGitHubOutput({
      tarball,
      name: found.pkg.name,
      "short-name": tag.shortName,
      version: tag.version,
      "npm-tag": tag.isPrerelease ? "next" : "latest",
      prerelease: String(tag.isPrerelease),
    });
    return;
  }

  let selected = packages;
  if (values.package !== undefined) {
    const found = findReleasePackage(packages, values.package);
    if (!found.ok) fail(found.reason);
    selected = [found.pkg];
  }
  let problemCount = 0;
  for (const pkg of selected) {
    const version = String(pkg.manifest.version);
    const { tarball, problems } = packPackage({ root, pkg, version, allowPrivate: true, outDir, workspaceVersions });
    const label = `${pkg.name}@${version}${pkg.manifest.private === true ? " (private: never published)" : ""}`;
    if (problems.length === 0) console.log(`ok ${label} -> ${tarball}`);
    else console.error(`fail ${label}:\n- ${problems.join("\n- ")}`);
    problemCount += problems.length;
  }
  if (problemCount > 0) fail(`Dry run: ${problemCount} problem(s) in ${SCOPE} packages`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCli();
}
