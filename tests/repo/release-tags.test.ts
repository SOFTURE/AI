import { describe, expect, it } from "vitest";
import { readReleasePackages } from "../../scripts/release/pack.mjs";
import { planReleaseTags } from "../../scripts/release/plan-tags.mjs";
import { REPO_ROOT } from "./repo-files.js";

interface Manifest {
  name: string;
  version: string;
  private?: boolean;
  dependencies?: Record<string, string>;
}

function buildPackage(manifest: Manifest) {
  return { name: manifest.name, dir: `modules/${manifest.name.split("/")[1] ?? ""}`, manifest: { ...manifest } };
}

const PACKAGES = [
  buildPackage({ name: "@softure-ai/auth", version: "0.2.0", dependencies: { "@softure-ai/core": "^0.1.0" } }),
  buildPackage({ name: "@softure-ai/core", version: "0.1.0" }),
  buildPackage({ name: "@softure-ai/template-module", version: "0.0.0", private: true }),
  buildPackage({ name: "@softure-ai/waitlist", version: "0.1.1", dependencies: { "@softure-ai/auth": "^0.2.0" } }),
];

describe("planReleaseTags", () => {
  it("plans every public package for all, dependencies first", () => {
    expect(planReleaseTags(PACKAGES, ["all"])).toEqual({
      ok: true,
      tags: ["core@0.1.0", "auth@0.2.0", "waitlist@0.1.1"],
    });
  });

  it("keeps dependency order for named packages and drops duplicates", () => {
    expect(planReleaseTags(PACKAGES, ["waitlist", "core", "waitlist"])).toEqual({
      ok: true,
      tags: ["core@0.1.0", "waitlist@0.1.1"],
    });
  });

  it("refuses an unknown package and names it", () => {
    expect(planReleaseTags(PACKAGES, ["core", "nope"])).toEqual({
      ok: false,
      reason: 'Planning release tags: no workspace package "@softure-ai/nope"',
    });
  });

  it("refuses a private package", () => {
    expect(planReleaseTags(PACKAGES, ["template-module"])).toEqual({
      ok: false,
      reason: "Planning release tags: @softure-ai/template-module is private and never released",
    });
  });

  it("refuses an empty request", () => {
    expect(planReleaseTags(PACKAGES, [])).toEqual({
      ok: false,
      reason: 'Planning release tags: name packages or "all"',
    });
  });

  it("plans the 16 public packages of this repository, core first", () => {
    const plan = planReleaseTags(readReleasePackages(REPO_ROOT), ["all"]);
    expect(plan.ok && plan.tags.length).toBe(16);
    expect(plan.ok && plan.tags[0]).toBe("core@0.1.0");
  });
});
