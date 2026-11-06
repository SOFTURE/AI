import { describe, expect, it } from "vitest";
import { getLockfileReach, getResolvedKeys } from "../../scripts/ci/lockfile-changes.mjs";

// A lockfile change reaches only the workspace packages whose installed tree changed (scripts/ci/lockfile-changes.mjs).

const WORKSPACES = [
  { name: "@softure-ai/a", dir: "modules/a" },
  { name: "@softure-ai/b", dir: "modules/b" },
  { name: "@softure-ai/c", dir: "modules/c" },
];

type Packages = Record<string, Record<string, unknown>>;

/** A small lockfile: a and b use zod (b a nested copy), c uses nothing, the root has vitest. */
function buildLockfile(changes: Packages = {}): { lockfileVersion: number; packages: Packages } {
  return {
    lockfileVersion: 3,
    packages: {
      "": { name: "root", workspaces: ["modules/*"], devDependencies: { vitest: "^5.0.0" } },
      "modules/a": { name: "@softure-ai/a", version: "0.1.0", dependencies: { zod: "^4.0.0", "@softure-ai/c": "^0.1.0" } },
      "modules/b": { name: "@softure-ai/b", version: "0.1.0", dependencies: { zod: "^3.0.0" }, devDependencies: { picocolors: "^1.0.0" } },
      "modules/c": { name: "@softure-ai/c", version: "0.1.0" },
      "node_modules/@softure-ai/c": { resolved: "modules/c", link: true },
      "node_modules/zod": { version: "4.1.0" },
      "modules/b/node_modules/zod": { version: "3.25.0" },
      "node_modules/picocolors": { version: "1.1.0" },
      "node_modules/vitest": { version: "5.1.0", dependencies: { tinypool: "^1.0.0" } },
      "node_modules/tinypool": { version: "1.0.0" },
      ...changes,
    },
  };
}

function getReach(changes: Packages): ReturnType<typeof getLockfileReach> {
  return getLockfileReach({ before: buildLockfile(), after: buildLockfile(changes), workspaces: WORKSPACES });
}

describe("getResolvedKeys", () => {
  it("resolves nested copies first and does not follow linked workspace packages", () => {
    const { packages } = buildLockfile();
    expect([...getResolvedKeys(packages, "modules/a")].sort()).toEqual(["node_modules/zod"]);
    expect([...getResolvedKeys(packages, "modules/b")].sort()).toEqual(["modules/b/node_modules/zod", "node_modules/picocolors"]);
    expect([...getResolvedKeys(packages, "modules/c")]).toEqual([]);
  });
});

describe("getLockfileReach", () => {
  it("reaches only the bumped package for a release's version bump", () => {
    expect(getReach({ "modules/c": { name: "@softure-ai/c", version: "0.2.0" } })).toEqual({ kind: "packages", names: ["@softure-ai/c"] });
  });

  it("reaches the packages that resolve an updated dependency, and only those", () => {
    expect(getReach({ "node_modules/zod": { version: "4.2.0" } })).toEqual({ kind: "packages", names: ["@softure-ai/a"] });
    expect(getReach({ "modules/b/node_modules/zod": { version: "3.26.0" } })).toEqual({ kind: "packages", names: ["@softure-ai/b"] });
  });

  it("counts development dependencies, which a package's tests run", () => {
    expect(getReach({ "node_modules/picocolors": { version: "1.2.0" } })).toEqual({ kind: "packages", names: ["@softure-ai/b"] });
  });

  it("reaches no package for an unchanged lockfile", () => {
    expect(getReach({})).toEqual({ kind: "packages", names: [] });
  });

  it("reaches every package for a repository tool, its dependencies, the root entry or an unreadable lockfile", () => {
    expect(getReach({ "node_modules/vitest": { version: "5.2.0", dependencies: { tinypool: "^1.0.0" } } }).kind).toBe("all");
    expect(getReach({ "node_modules/tinypool": { version: "1.0.1" } }).kind).toBe("all");
    expect(getReach({ "": { name: "root", workspaces: ["modules/*"], devDependencies: { vitest: "^5.2.0" } } }).kind).toBe("all");
    expect(getLockfileReach({ before: {}, after: buildLockfile(), workspaces: WORKSPACES }).kind).toBe("all");
  });
});
