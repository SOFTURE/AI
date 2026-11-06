import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import {
  LOCKFILE,
  SHARED_PATHS,
  ROOT_TEST_PATH,
  findRuntimeWorkspaces,
  getAffectedAreas,
  getAreas,
  getTestScope,
} from "../../scripts/ci/affected.mjs";
import { findWorkspaces } from "../../scripts/build-workspaces.mjs";
import type { LockfileReach } from "../../scripts/ci/lockfile-changes.mjs";
import { REPO_ROOT } from "./repo-files.js";

// The slow jobs of ci.yml and e2e.yml run only for the areas a change reaches. A skipped area must never hide a red
// one, so anything shared, unknown or cut short runs every area.

const AREAS = getAreas(REPO_ROOT);
const PACKAGES = findRuntimeWorkspaces(REPO_ROOT);

function getAffected(files: string[]): Record<string, boolean> {
  return getAffectedAreas({
    changed: { kind: "files", files },
    areas: AREAS,
    packages: PACKAGES,
  });
}

function getReached(files: string[]): string[] {
  return Object.entries(getAffected(files))
    .filter(([, value]) => value)
    .map(([name]) => name)
    .sort();
}

describe("getAffectedAreas", () => {
  it("reaches only marketing-kit for a marketing-kit change", () => {
    expect(getReached(["tools/marketing-kit/src/footage/compose.ts"])).toEqual([
      "marketing-kit",
    ]);
  });

  it("reaches only the host area for a host change", () => {
    expect(getReached(["tools/host/playbooks/app.yml"])).toEqual(["host"]);
  });

  it("reaches the example app and the deploy init image for a package the example app installs", () => {
    expect(getReached(["modules/auth/src/index.ts"])).toEqual([
      "deploy",
      "example-app",
    ]);
  });

  it("reaches through workspace dependencies: core is under the example app, deploy and host", () => {
    expect(getReached(["foundation/core/src/index.ts"])).toEqual([
      "deploy",
      "example-app",
      "host",
    ]);
  });

  it("reaches the deploy and host areas, not the example app's tests, for a deploy CLI change", () => {
    expect(getReached(["tools/deploy/src/cli/run.ts"])).toEqual([
      "deploy",
      "host",
    ]);
  });

  it("reaches the example app and the deploy init image for a change in examples/", () => {
    expect(getReached(["examples/next-app/app/page.tsx"])).toEqual([
      "deploy",
      "example-app",
    ]);
  });

  it("reaches nothing for docs, context and an unrelated package", () => {
    expect(
      getReached([
        "docs/02-module-standard.md",
        "context/archive/README.md",
        "modules/llm/src/index.ts",
      ]),
    ).toEqual([]);
    expect(getReached([])).toEqual([]);
  });

  it.each([
    "package.json",
    "tsconfig.base.json",
    "scripts/ci/affected.mjs",
    ".github/workflows/e2e.yml",
  ])("reaches every area for the shared file %s", (file) => {
    expect(getReached([file])).toEqual(AREAS.map((area) => area.name).sort());
  });

  it("reaches only the packages a lockfile change names, and every area when its reach is unknown or total", () => {
    const lockfileOf = (lockfile: LockfileReach): string[] =>
      Object.entries(
        getAffectedAreas({
          changed: { kind: "files", files: [LOCKFILE], lockfile },
          areas: AREAS,
          packages: PACKAGES,
        }),
      )
        .filter(([, value]) => value)
        .map(([name]) => name)
        .sort();
    expect(
      lockfileOf({ kind: "packages", names: ["@softure-ai/marketing-kit"] }),
    ).toEqual(["marketing-kit"]);
    expect(
      lockfileOf({ kind: "packages", names: ["@softure-ai/llm"] }),
    ).toEqual([]);
    expect(
      lockfileOf({ kind: "packages", names: ["@softure-ai/core"] }),
    ).toEqual(["deploy", "example-app", "host"]);
    expect(
      lockfileOf({ kind: "all", reason: "vitest is a repository tool" }),
    ).toEqual(AREAS.map((area) => area.name).sort());
    expect(getReached([LOCKFILE])).toEqual(
      AREAS.map((area) => area.name).sort(),
    );
  });

  it("reaches every area when the files are unknown", () => {
    const affected = getAffectedAreas({
      changed: { kind: "all", reason: "a schedule run" },
      areas: AREAS,
      packages: PACKAGES,
    });
    expect(Object.values(affected)).toEqual(AREAS.map(() => true));
  });

  it("ignores development dependencies: a package that only tests with marketing-kit is not reached by it", () => {
    const deploy = PACKAGES.find((pkg) => pkg.name === "@softure-ai/deploy");
    expect(deploy?.dependencyNames).not.toContain("@softure-ai/marketing-kit");
  });
});

interface Job {
  needs?: string | string[];
  if?: string;
  outputs?: Record<string, string>;
  steps?: { run?: string }[];
}

describe.each([
  [
    "ci.yml",
    ["render", "footage-image", "host-ansible"],
    ["static", "workflows", "build"],
  ],
  ["e2e.yml", ["e2e", "container", "deploy-init"], []],
])("%s", (name, gated, always) => {
  const jobs = (
    parse(readFileSync(join(REPO_ROOT, ".github/workflows", name), "utf8")) as {
      jobs: Record<string, Job>;
    }
  ).jobs;
  const changes = jobs.changes;
  const names = AREAS.map((area) => area.name);

  it("lists the changed areas with the script, one output per area it gates on", () => {
    expect(
      changes?.steps?.some(
        (step) => step.run === "node scripts/ci/affected.mjs",
      ),
    ).toBe(true);
    for (const [output, value] of Object.entries(changes?.outputs ?? {})) {
      expect([...names, "test-paths"]).toContain(output);
      expect(value).toBe(`\${{ steps.areas.outputs.${output} }}`);
    }
  });

  it.each(gated)("runs %s only when its area is reached", (id) => {
    const job = jobs[id];
    expect(job?.needs).toBe("changes");
    const area = /^needs\.changes\.outputs\.([a-z-]+) == 'true'$/.exec(
      job?.if ?? "",
    )?.[1];
    expect(Object.keys(changes?.outputs ?? {})).toContain(area);
  });

  it.each(always)("always runs the gate %s", (id) => {
    expect(jobs[id]?.if).toBeUndefined();
    expect(jobs[id]?.needs).toBeUndefined();
  });

  it.runIf(name === "ci.yml")(
    "always runs the tests, a pull request's only for the packages it reaches",
    () => {
      const test = jobs.test as Job & {
        steps?: { env?: Record<string, string> }[];
      };
      expect(test.needs).toBe("changes");
      expect(test.if).toBeUndefined();
      expect(changes?.outputs?.["test-paths"]).toBe(
        "${{ steps.areas.outputs.test-paths }}",
      );
      expect(JSON.stringify(test.steps)).toContain(
        "github.event_name == 'pull_request' && needs.changes.outputs.test-paths || ''",
      );
    },
  );

  it("counts the workflow itself as shared", () => {
    expect(SHARED_PATHS).toContain(`.github/workflows/${name}`);
  });
});

describe("getTestScope", () => {
  const WORKSPACES = findWorkspaces(REPO_ROOT);

  function getScope(
    files: string[],
    lockfile?: LockfileReach,
  ): ReturnType<typeof getTestScope> {
    return getTestScope({
      changed: {
        kind: "files",
        files,
        ...(lockfile === undefined ? {} : { lockfile }),
      },
      packages: WORKSPACES,
    });
  }

  it("tests a changed package and the packages that depend on it, with the repository tests", () => {
    const scope = getScope(["modules/billing/src/stripe.ts"]);
    expect(scope.kind).toBe("paths");
    const paths = scope.kind === "paths" ? scope.paths : [];
    expect(paths[0]).toBe(ROOT_TEST_PATH);
    expect(paths).toContain("modules/billing/");
    expect(paths).not.toContain("modules/llm/");
    expect(paths).not.toContain("tools/marketing-kit/");
    for (const pkg of WORKSPACES) {
      if (pkg.dependencyNames.includes("@softure-ai/billing"))
        expect(paths).toContain(`${pkg.dir}/`);
    }
  });

  it("tests only the repository tests for a change outside every package", () => {
    expect(
      getScope([
        "docs/02-module-standard.md",
        "examples/next-app/app/page.tsx",
      ]),
    ).toEqual({
      kind: "paths",
      paths: [ROOT_TEST_PATH],
    });
  });

  it("tests a release's version bump in the bumped package and its dependents only", () => {
    const scope = getScope(
      [
        "tools/marketing-kit/package.json",
        "tools/marketing-kit/CHANGELOG.md",
        LOCKFILE,
      ],
      {
        kind: "packages",
        names: ["@softure-ai/marketing-kit"],
      },
    );
    const paths = scope.kind === "paths" ? scope.paths : [];
    expect(paths).toContain("tools/marketing-kit/");
    // deploy tests its film commands with marketing-kit (a development dependency).
    expect(paths).toContain("tools/deploy/");
    expect(paths).not.toContain("modules/billing/");
    expect(paths).not.toContain("foundation/core/");
  });

  it("runs the whole suite for a shared root file, a lockfile change of unknown reach, or a run without a file list", () => {
    expect(getScope(["vitest.config.mts"]).kind).toBe("all");
    expect(getScope([LOCKFILE]).kind).toBe("all");
    expect(
      getScope([LOCKFILE], {
        kind: "all",
        reason: "vitest is a repository tool",
      }).kind,
    ).toBe("all");
    expect(
      getTestScope({
        changed: { kind: "all", reason: "a push run" },
        packages: WORKSPACES,
      }).kind,
    ).toBe("all");
  });
});
