// @ts-check
// Which workspace packages a change of package-lock.json reaches (scripts/ci/affected.mjs).
//
// A lockfile change is not shared by every package: a release's version bump changes one workspace entry, and a
// dependency update changes the entries of the packages that install it. Both lockfiles (before and after) are walked
// the way Node resolves a package: from each workspace package through its declared dependencies (every kind, so its
// tests' tools count), into `node_modules` entries and their own dependencies, nested folders first. A workspace is
// reached when its own entry or an entry it resolves changed. A repository tool the root package names (Vitest, ESLint,
// TypeScript), an entry only the root package resolves, and the root entry itself reach every package.

/**
 * @typedef {{ name: string, dir: string }} WorkspaceDir
 * @typedef {{ kind: "packages", names: string[] } | { kind: "all", reason: string }} LockfileReach
 * @typedef {Record<string, Record<string, unknown>>} LockfilePackages
 */

/**
 * The `packages` map of a lockfile (lockfileVersion 2 or 3), or null when it has none.
 * @param {unknown} lockfile
 * @returns {LockfilePackages | null}
 */
export function readLockfilePackages(lockfile) {
  if (
    typeof lockfile !== "object" ||
    lockfile === null ||
    !("packages" in lockfile)
  )
    return null;
  const packages = lockfile.packages;
  return typeof packages === "object" && packages !== null
    ? /** @type {LockfilePackages} */ (packages)
    : null;
}

/**
 * The folder whose `node_modules` Node searches next: `a/node_modules/b` → `a`, a top-level entry or a workspace → root.
 * @param {string} key
 * @returns {string}
 */
function getParentKey(key) {
  const index = key.lastIndexOf("/node_modules/");
  return index === -1 ? "" : key.slice(0, index);
}

/**
 * The entry Node finds for `name` from the package at `fromKey`, walking up the nested `node_modules` folders.
 * @param {LockfilePackages} packages
 * @param {string} name
 * @param {string} fromKey
 * @returns {string | null}
 */
function resolveKey(packages, name, fromKey) {
  let dir = fromKey;
  for (;;) {
    const key =
      dir === "" ? `node_modules/${name}` : `${dir}/node_modules/${name}`;
    if (key in packages) return key;
    if (dir === "") return null;
    dir = getParentKey(dir);
  }
}

/**
 * Names of the dependencies an entry installs; a workspace or the root entry also counts its development ones.
 * @param {Record<string, unknown>} entry
 * @param {boolean} withDevelopment
 * @returns {string[]}
 */
function getEntryDependencies(entry, withDevelopment) {
  const fields = [
    "dependencies",
    "optionalDependencies",
    "peerDependencies",
    ...(withDevelopment ? ["devDependencies"] : []),
  ];
  return fields.flatMap((field) => {
    const dependencies = entry[field];
    return typeof dependencies === "object" && dependencies !== null
      ? Object.keys(dependencies)
      : [];
  });
}

/**
 * Every `node_modules` entry the package at `startKey` resolves, directly or through other entries. A linked entry
 * (another workspace package) is not followed: the workspace graph covers it.
 * @param {LockfilePackages} packages
 * @param {string} startKey
 * @returns {Set<string>}
 */
export function getResolvedKeys(packages, startKey) {
  /** @type {Set<string>} */
  const resolved = new Set();
  const start = packages[startKey];
  if (start === undefined) return resolved;
  /** @type {[string, string][]} */
  const queue = getEntryDependencies(start, true).map((name) => [
    name,
    startKey,
  ]);
  for (let next = queue.pop(); next !== undefined; next = queue.pop()) {
    const key = resolveKey(packages, next[0], next[1]);
    if (key === null || resolved.has(key)) continue;
    const entry = packages[key];
    if (entry === undefined || entry.link === true) continue;
    resolved.add(key);
    for (const name of getEntryDependencies(entry, false))
      queue.push([name, key]);
  }
  return resolved;
}

/**
 * The entries whose content differs between the two lockfiles, added and removed ones included.
 * @param {LockfilePackages} before
 * @param {LockfilePackages} after
 * @returns {Set<string>}
 */
export function getChangedKeys(before, after) {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return new Set(
    [...keys].filter(
      (key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]),
    ),
  );
}

/**
 * Which workspace packages the lockfile change reaches, or why it reaches every package.
 * @param {{ before: unknown, after: unknown, workspaces: WorkspaceDir[] }} options
 * @returns {LockfileReach}
 */
export function getLockfileReach({ before, after, workspaces }) {
  const beforePackages = readLockfilePackages(before);
  const afterPackages = readLockfilePackages(after);
  if (beforePackages === null || afterPackages === null)
    return { kind: "all", reason: "a lockfile without a packages map" };
  const changed = getChangedKeys(beforePackages, afterPackages);
  if (changed.has(""))
    return {
      kind: "all",
      reason: "the root entry of package-lock.json changed",
    };
  /** @type {Set<string>} */
  const names = new Set();
  /** @type {Set<string>} */
  const coveredKeys = new Set();
  for (const workspace of workspaces) {
    if (changed.has(workspace.dir)) names.add(workspace.name);
    for (const packages of [beforePackages, afterPackages]) {
      for (const key of getResolvedKeys(packages, workspace.dir)) {
        coveredKeys.add(key);
        if (changed.has(key)) names.add(workspace.name);
      }
    }
  }
  for (const packages of [beforePackages, afterPackages]) {
    // A tool the root package names itself (Vitest, ESLint, TypeScript) serves every package's checks.
    const root = packages[""] ?? {};
    for (const name of getEntryDependencies(root, true)) {
      const key = resolveKey(packages, name, "");
      if (key !== null && changed.has(key))
        return { kind: "all", reason: `${key} is a repository tool` };
    }
    for (const key of getResolvedKeys(packages, "")) {
      if (changed.has(key) && !coveredKeys.has(key))
        return {
          kind: "all",
          reason: `${key} serves only the repository tools`,
        };
    }
  }
  return { kind: "packages", names: [...names].sort() };
}
