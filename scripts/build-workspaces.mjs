// @ts-check
// Builds every workspace package in dependency order: `npm run build` at the root.
//
// `npm run build --workspaces` follows the order of the `workspaces` list, not the dependency
// graph, and `modules/auth` sorts before `modules/security`, which it depends on. Each package
// builds with `tsc` against the `dist/` types of its dependencies, so they must exist first.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * @typedef {{ name: string, dir: string, dependencyNames: string[] }} WorkspacePackage
 */

/**
 * Reads a JSON file into an untyped value; callers narrow what they use.
 * @param {string} path
 * @returns {unknown}
 */
function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Names of every dependency kind a package declares.
 * @param {Record<string, unknown>} manifest
 * @returns {string[]}
 */
function getDependencyNames(manifest) {
  return ["dependencies", "peerDependencies", "optionalDependencies", "devDependencies"].flatMap((field) => {
    const dependencies = manifest[field];
    return isRecord(dependencies) ? Object.keys(dependencies) : [];
  });
}

/**
 * Workspace packages declared by the root `package.json` (`dir/*` and plain folder patterns).
 * @param {string} root repository root
 * @returns {WorkspacePackage[]}
 */
export function findWorkspaces(root) {
  const manifest = readJson(join(root, "package.json"));
  const patterns = isRecord(manifest) && Array.isArray(manifest.workspaces) ? manifest.workspaces : [];
  const dirs = patterns.flatMap((pattern) => {
    if (typeof pattern !== "string") return [];
    if (!pattern.endsWith("/*")) return [pattern];
    const parent = pattern.slice(0, -2);
    if (!existsSync(join(root, parent))) return [];
    return readdirSync(join(root, parent), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => `${parent}/${entry.name}`)
      .sort();
  });
  return dirs.flatMap((dir) => {
    const manifestPath = join(root, dir, "package.json");
    if (!existsSync(manifestPath)) return [];
    const packageManifest = readJson(manifestPath);
    if (!isRecord(packageManifest) || typeof packageManifest.name !== "string") {
      throw new Error(`Reading workspace ${dir}: package.json has no "name"`);
    }
    return [{ name: packageManifest.name, dir, dependencyNames: getDependencyNames(packageManifest) }];
  });
}

/**
 * Orders packages so each one comes after the workspace packages it depends on. Independent
 * packages keep their input order. Dependencies outside the workspace are ignored.
 * @param {WorkspacePackage[]} packages
 * @returns {WorkspacePackage[]}
 */
export function orderWorkspaces(packages) {
  const names = new Set(packages.map((pkg) => pkg.name));
  /** @type {WorkspacePackage[]} */
  const ordered = [];
  const done = new Set();
  let remaining = packages;
  while (remaining.length > 0) {
    const ready = remaining.filter((pkg) =>
      pkg.dependencyNames.every((dependency) => !names.has(dependency) || done.has(dependency)),
    );
    if (ready.length === 0) {
      throw new Error(`Workspace dependency cycle between: ${remaining.map((pkg) => pkg.name).join(", ")}`);
    }
    for (const pkg of ready) {
      ordered.push(pkg);
      done.add(pkg.name);
    }
    remaining = remaining.filter((pkg) => !done.has(pkg.name));
  }
  return ordered;
}

function runCli() {
  const root = fileURLToPath(new URL("../", import.meta.url));
  for (const pkg of orderWorkspaces(findWorkspaces(root))) {
    console.log(`\n> build ${pkg.name} (${pkg.dir})`);
    // Throws on the first failing build; its output is already on the terminal.
    execFileSync("npm", ["run", "build", "--if-present", "-w", pkg.dir], { cwd: root, stdio: "inherit" });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCli();
}
