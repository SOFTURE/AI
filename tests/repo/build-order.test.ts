import { describe, expect, it } from "vitest";
import { findWorkspaces, orderWorkspaces } from "../../scripts/build-workspaces.mjs";
import { REPO_ROOT } from "./repo-files.js";

function buildPackage(name: string, dependencyNames: string[] = []) {
  return { name, dir: `modules/${name}`, dependencyNames };
}

function getNames(packages: { name: string }[]): string[] {
  return packages.map((pkg) => pkg.name);
}

describe("orderWorkspaces", () => {
  it("builds a package after the workspace packages it depends on, whatever the input order", () => {
    const auth = buildPackage("@softure-ai/auth", ["@softure-ai/security", "@softure-ai/core"]);
    const security = buildPackage("@softure-ai/security", ["@softure-ai/core"]);
    const core = buildPackage("@softure-ai/core");
    expect(getNames(orderWorkspaces([auth, security, core]))).toEqual([
      "@softure-ai/core",
      "@softure-ai/security",
      "@softure-ai/auth",
    ]);
  });

  it("keeps the input order between packages that do not depend on each other", () => {
    expect(getNames(orderWorkspaces([buildPackage("b"), buildPackage("a")]))).toEqual(["b", "a"]);
  });

  it("ignores dependencies that are not workspace packages", () => {
    expect(getNames(orderWorkspaces([buildPackage("a", ["react", "zod"])]))).toEqual(["a"]);
  });

  it("returns an empty list for no packages", () => {
    expect(orderWorkspaces([])).toEqual([]);
  });

  it("throws on a dependency cycle and names the packages in it", () => {
    const packages = [buildPackage("a", ["b"]), buildPackage("b", ["a"]), buildPackage("c")];
    expect(() => orderWorkspaces(packages)).toThrow("Workspace dependency cycle between: a, b");
  });
});

describe("findWorkspaces", () => {
  it("finds the template package with its dependencies on other workspaces", () => {
    const template = findWorkspaces(REPO_ROOT).find((pkg) => pkg.dir === "templates/package");
    expect(template).toEqual({ name: "@softure-ai/template-module", dir: "templates/package", dependencyNames: [] });
  });
});
