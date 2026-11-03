import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readReleasePackages } from "../../scripts/release/pack.mjs";
import {
  REPOSITORY_URL,
  checkInternalRanges,
  checkManifest,
  checkPackedFiles,
  findRegistryWorkspaceCopies,
  findReleasePackage,
  parseReleaseTag,
} from "../../scripts/release/release-rules.mjs";
import { REPO_ROOT } from "./repo-files.js";

function buildManifest(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name: "@softure-ai/core",
    version: "0.1.0",
    license: "MIT",
    type: "module",
    files: ["dist", "src", "!src/**/*.test.ts", "migrations", "module.json"],
    repository: { type: "git", url: REPOSITORY_URL, directory: "foundation/core" },
    publishConfig: { access: "public", provenance: true },
    exports: {
      ".": {
        "@softure-ai/source": "./src/index.ts",
        types: "./dist/index.d.ts",
        default: "./dist/index.js",
      },
    },
    ...overrides,
  };
}

function buildManifestInput(overrides: Partial<Parameters<typeof checkManifest>[0]> = {}) {
  return {
    manifest: buildManifest(),
    dir: "foundation/core",
    version: "0.1.0",
    moduleVersion: null,
    workspaceVersions: new Map<string, string>(),
    allowPrivate: false,
    ...overrides,
  };
}

const PACKED_FILES = [
  "package.json",
  "README.md",
  "LICENSE",
  "dist/index.js",
  "dist/index.js.map",
  "dist/index.d.ts",
  "dist/index.d.ts.map",
  "src/index.ts",
];

const SOURCE_MAPS = [
  { path: "dist/index.js.map", sources: ["../src/index.ts"] },
  { path: "dist/index.d.ts.map", sources: ["../src/index.ts"] },
];

describe("parseReleaseTag", () => {
  it("reads the package short name and the version of a release tag", () => {
    expect(parseReleaseTag("core@0.1.0")).toEqual({
      ok: true,
      shortName: "core",
      version: "0.1.0",
      isPrerelease: false,
    });
  });

  it("marks a version with a prerelease suffix", () => {
    expect(parseReleaseTag("feature-switches@1.2.0-beta.1")).toEqual({
      ok: true,
      shortName: "feature-switches",
      version: "1.2.0-beta.1",
      isPrerelease: true,
    });
  });

  it.each([
    ["core-0.1.0", "no @"],
    ["v0.1.0", "the single-package form"],
    ["Core@0.1.0", "an uppercase name"],
    ["core@1.2", "a short version"],
    ["core@01.2.3", "a leading zero"],
    ["core@0.1.0@x", "two @"],
    ["", "an empty tag"],
  ])("rejects %j (%s) and names the expected form", (tag) => {
    const result = parseReleaseTag(tag);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("<package>@x.y.z");
  });
});

describe("findReleasePackage", () => {
  const packages = [
    { name: "@softure-ai/template-module", dir: "templates/package", manifest: {} },
    { name: "@softure-ai/core", dir: "foundation/core", manifest: {} },
  ];

  it("finds the workspace published as @softure-ai/<short name>", () => {
    const result = findReleasePackage(packages, "core");
    expect(result).toEqual({ ok: true, pkg: packages[1] });
  });

  it("names the short name and the known packages when nothing matches", () => {
    const result = findReleasePackage(packages, "db");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("@softure-ai/db");
      expect(result.reason).toContain("@softure-ai/core");
    }
  });
});

describe("checkManifest", () => {
  it("accepts a publishable manifest", () => {
    expect(checkManifest(buildManifestInput())).toEqual([]);
  });

  it("rejects a private package unless the run is a dry run", () => {
    const manifest = buildManifest({ private: true });
    expect(checkManifest(buildManifestInput({ manifest }))).toEqual([
      expect.stringContaining('"private": true'),
    ]);
    expect(checkManifest(buildManifestInput({ manifest, allowPrivate: true }))).toEqual([]);
  });

  it("rejects a version that differs from the tag", () => {
    expect(checkManifest(buildManifestInput({ version: "0.2.0" }))).toEqual([
      expect.stringMatching(/version 0\.1\.0.*tag.*0\.2\.0/),
    ]);
  });

  it("rejects a module.json version that differs from package.json", () => {
    expect(checkManifest(buildManifestInput({ moduleVersion: "0.0.9" }))).toEqual([
      expect.stringMatching(/module\.json.*0\.0\.9/),
    ]);
    expect(checkManifest(buildManifestInput({ moduleVersion: "0.1.0" }))).toEqual([]);
  });

  it("rejects a license other than MIT", () => {
    expect(checkManifest(buildManifestInput({ manifest: buildManifest({ license: "ISC" }) }))).toEqual([
      expect.stringContaining("license"),
    ]);
  });

  it.each([
    ["missing", undefined],
    ["another repository", { type: "git", url: "git+https://github.com/SOFTURE/SKILLS.git", directory: "foundation/core" }],
    ["another directory", { type: "git", url: REPOSITORY_URL, directory: "templates/package" }],
  ])("rejects a repository field that is %s", (_case, repository) => {
    expect(checkManifest(buildManifestInput({ manifest: buildManifest({ repository }) }))).toEqual([
      expect.stringContaining("repository"),
    ]);
  });

  it("rejects a publishConfig that is not public with provenance", () => {
    const manifest = buildManifest({ publishConfig: { access: "restricted" } });
    expect(checkManifest(buildManifestInput({ manifest }))).toEqual([expect.stringContaining("publishConfig")]);
  });

  it.each([
    ["without dist", ["src", "module.json"], "dist"],
    ["without src", ["dist", "module.json"], "src"],
    ["with tests", ["dist", "src", "tests"], "tests"],
    ["with a tests subfolder", ["dist", "src", "tests/fixtures"], "tests"],
  ])("rejects files %s", (_case, files, word) => {
    expect(checkManifest(buildManifestInput({ manifest: buildManifest({ files }) }))).toEqual([
      expect.stringContaining(word),
    ]);
  });

  it("accepts internal dependency ranges the workspace version satisfies", () => {
    const manifest = buildManifest({ dependencies: { "@softure-ai/core": "^0.1.0", zod: "^4.0.0" } });
    const workspaceVersions = new Map([["@softure-ai/core", "0.1.3"]]);
    expect(checkManifest(buildManifestInput({ manifest, workspaceVersions }))).toEqual([]);
  });

  it("rejects an internal dependency range the workspace version does not satisfy", () => {
    const manifest = buildManifest({ peerDependencies: { "@softure-ai/core": "^0.1.0" } });
    const workspaceVersions = new Map([["@softure-ai/core", "0.2.0"]]);
    expect(checkManifest(buildManifestInput({ manifest, workspaceVersions }))).toEqual([
      expect.stringMatching(/@softure-ai\/core.*\^0\.1\.0.*0\.2\.0/),
    ]);
  });

  it("rejects an internal dependency that is not a version range", () => {
    const manifest = buildManifest({ dependencies: { "@softure-ai/core": "*" } });
    const workspaceVersions = new Map([["@softure-ai/core", "0.1.0"]]);
    expect(checkManifest(buildManifestInput({ manifest, workspaceVersions }))).toEqual([
      expect.stringContaining('"*"'),
    ]);
  });
});

describe("checkInternalRanges", () => {
  it("rejects a devDependencies range the workspace version does not satisfy, since npm then fetches a registry copy", () => {
    const manifest = buildManifest({ devDependencies: { "@softure-ai/mcp-access": "^0.2.0", vitest: "^4.0.0" } });
    const workspaceVersions = new Map([["@softure-ai/mcp-access", "0.3.0"]]);
    expect(checkInternalRanges(manifest, workspaceVersions)).toEqual([
      "devDependencies.@softure-ai/mcp-access range ^0.2.0 does not accept the workspace version 0.3.0",
    ]);
  });

  it("accepts a devDependencies range the workspace version satisfies", () => {
    const manifest = buildManifest({ devDependencies: { "@softure-ai/mcp-access": "^0.3.0" } });
    const workspaceVersions = new Map([["@softure-ai/mcp-access", "0.3.1"]]);
    expect(checkInternalRanges(manifest, workspaceVersions)).toEqual([]);
  });

  it("accepts every internal range of every workspace in the repository, devDependencies included", () => {
    const packages = readReleasePackages(REPO_ROOT);
    const workspaceVersions = new Map(packages.map((pkg) => [pkg.name, String(pkg.manifest.version)]));
    const problems = packages.flatMap((pkg) =>
      checkInternalRanges(pkg.manifest, workspaceVersions).map((problem) => `${pkg.dir}: ${problem}`),
    );
    expect(problems).toEqual([]);
  });
});

describe("findRegistryWorkspaceCopies", () => {
  const workspaceNames = new Set(["@softure-ai/core", "@softure-ai/deploy"]);

  it("lists nothing when every workspace entry is a link", () => {
    const lock = {
      packages: {
        "": { name: "softure-ai" },
        "node_modules/@softure-ai/core": { resolved: "foundation/core", link: true },
        "node_modules/@softure-ai/deploy": { resolved: "tools/deploy", link: true },
        "node_modules/zod": { version: "4.0.0", resolved: "https://registry.npmjs.org/zod/-/zod-4.0.0.tgz" },
      },
    };
    expect(findRegistryWorkspaceCopies(lock, workspaceNames)).toEqual([]);
  });

  it("lists a nested registry copy and a top-level entry that is not a link, sorted", () => {
    const lock = {
      packages: {
        "node_modules/@softure-ai/core": { version: "0.1.0", resolved: "https://registry.npmjs.org/core.tgz" },
        "modules/agent-ready/node_modules/@softure-ai/deploy": {
          version: "0.4.10",
          resolved: "https://registry.npmjs.org/@softure-ai/deploy/-/deploy-0.4.10.tgz",
        },
        "tools/deploy/node_modules/@softure-ai/other": { version: "1.0.0" },
      },
    };
    expect(findRegistryWorkspaceCopies(lock, workspaceNames)).toEqual([
      "modules/agent-ready/node_modules/@softure-ai/deploy",
      "node_modules/@softure-ai/core",
    ]);
  });

  it("lists nothing for a lockfile without a packages map", () => {
    expect(findRegistryWorkspaceCopies({ lockfileVersion: 1 }, workspaceNames)).toEqual([]);
    expect(findRegistryWorkspaceCopies(null, workspaceNames)).toEqual([]);
  });

  it("finds no registry copy of a workspace package in the committed lockfile", () => {
    const lock: unknown = JSON.parse(readFileSync(join(REPO_ROOT, "package-lock.json"), "utf8"));
    const names = new Set(readReleasePackages(REPO_ROOT).map((pkg) => pkg.name));
    expect(findRegistryWorkspaceCopies(lock, names)).toEqual([]);
  });
});

describe("checkPackedFiles", () => {
  const manifest = buildManifest();

  it("accepts a tarball with every export target, the license and resolvable maps", () => {
    expect(checkPackedFiles({ manifest, files: PACKED_FILES, sourceMaps: SOURCE_MAPS })).toEqual([]);
  });

  it("names a missing export target with its condition", () => {
    const files = PACKED_FILES.filter((file) => file !== "dist/index.d.ts");
    expect(checkPackedFiles({ manifest, files, sourceMaps: SOURCE_MAPS })).toEqual([
      expect.stringMatching(/"\.".*types.*dist\/index\.d\.ts/),
    ]);
  });

  it.each(["LICENSE", "README.md"])("requires %s", (required) => {
    const files = PACKED_FILES.filter((file) => file !== required);
    expect(checkPackedFiles({ manifest, files, sourceMaps: SOURCE_MAPS })).toEqual([
      expect.stringContaining(required),
    ]);
  });

  it("rejects test files and the tests folder", () => {
    const files = [...PACKED_FILES, "src/index.test.ts", "tests/messages.test.ts"];
    expect(checkPackedFiles({ manifest, files, sourceMaps: SOURCE_MAPS })).toEqual([
      expect.stringContaining("src/index.test.ts"),
      expect.stringContaining("tests/messages.test.ts"),
    ]);
  });

  it.each(["dist/index.test.js", "dist/index.test.d.ts", "dist/ui/button.test.jsx"])(
    "rejects the compiled test file %s",
    (file) => {
      expect(checkPackedFiles({ manifest, files: [...PACKED_FILES, file], sourceMaps: SOURCE_MAPS })).toEqual([
        expect.stringContaining(file),
      ]);
    },
  );

  it("checks a string exports field as the root entry", () => {
    const stringExports = buildManifest({ exports: "./dist/main.js" });
    expect(checkPackedFiles({ manifest: stringExports, files: PACKED_FILES, sourceMaps: [] })).toEqual([
      expect.stringContaining("dist/main.js"),
    ]);
  });

  it("checks conditions nested below the first level", () => {
    const nested = buildManifest({
      exports: { ".": { import: { types: "./dist/index.d.ts", default: "./dist/missing.js" } } },
    });
    expect(checkPackedFiles({ manifest: nested, files: PACKED_FILES, sourceMaps: [] })).toEqual([
      expect.stringMatching(/"\.".*default.*dist\/missing\.js/),
    ]);
  });

  it("accepts a subpath pattern that matches a packed file and rejects one that matches none", () => {
    const pattern = (target: string) => buildManifest({ exports: { "./*": target } });
    expect(checkPackedFiles({ manifest: pattern("./dist/*.js"), files: PACKED_FILES, sourceMaps: [] })).toEqual([]);
    expect(checkPackedFiles({ manifest: pattern("./lib/*.js"), files: PACKED_FILES, sourceMaps: [] })).toEqual([
      expect.stringContaining("./lib/*.js"),
    ]);
  });

  it("checks main and types when a manifest has them", () => {
    const legacy = buildManifest({ main: "./dist/index.js", types: "./dist/types.d.ts" });
    expect(checkPackedFiles({ manifest: legacy, files: PACKED_FILES, sourceMaps: SOURCE_MAPS })).toEqual([
      expect.stringMatching(/types.*dist\/types\.d\.ts/),
    ]);
  });

  it("names a source map whose source is not in the tarball", () => {
    const sourceMaps = [{ path: "dist/server/index.js.map", sources: ["../../src/server/index.ts"] }];
    expect(checkPackedFiles({ manifest, files: PACKED_FILES, sourceMaps })).toEqual([
      expect.stringMatching(/dist\/server\/index\.js\.map.*src\/server\/index\.ts/),
    ]);
  });
});
