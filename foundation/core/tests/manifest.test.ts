import { describe, expect, it } from "vitest";
import { moduleManifestSchema, type ModuleManifest } from "@softure-ai/core";

const valid: ModuleManifest = {
  id: "auth",
  version: "0.1.0",
  dependsOn: { security: "^0.1.0", mailing: "^0.1.0?" },
  dbSchema: "auth",
  tables: ["users", "sessions"],
  env: [{ name: "SOFTURE_AUTH_INSECURE_COOKIES", required: false, description: "dev without HTTPS" }],
  switches: ["auth.registration_closed"],
  routes: { login: "/login", afterLogin: "/" },
  mount: [
    { kind: "route-handler", path: "app/api/softure/auth/[...path]/route.ts" },
    { kind: "page", path: "app/login/page.tsx", export: "LoginPage" },
  ],
  privacy: { exports: true, deletes: true },
};

function getIssuePaths(input: unknown): string[] {
  const result = moduleManifestSchema.safeParse(input);
  return result.success ? [] : result.error.issues.map((issue) => issue.path.join("."));
}

describe("moduleManifestSchema", () => {
  it("accepts the docs/02 §3 example", () => {
    expect(moduleManifestSchema.parse(valid)).toEqual(valid);
  });

  it("accepts a module without a database schema", () => {
    expect(getIssuePaths({ ...valid, dbSchema: null, tables: [] })).toEqual([]);
  });

  it.each([
    ["id", { id: "Auth Module" }],
    ["version", { version: "0.1" }],
    ["dependsOn.security", { dependsOn: { security: ">=0.1.0" } }],
    ["dbSchema", { dbSchema: "Auth-Schema" }],
    ["tables", { tables: ["users", "users"] }],
    ["env.0.name", { env: [{ name: "lower_case", required: true, description: "x" }] }],
    ["switches.0", { switches: ["registration_closed"] }],
    ["routes.login", { routes: { login: "login" } }],
    ["mount.0.kind", { mount: [{ kind: "layout", path: "app/layout.tsx" }] }],
    ["privacy.exports", { privacy: { exports: "yes", deletes: true } }],
  ])("reports %s when it is invalid", (path, patch) => {
    expect(getIssuePaths({ ...valid, ...patch })).toContain(path);
  });

  it("reports tables declared without a database schema", () => {
    expect(getIssuePaths({ ...valid, dbSchema: null })).toEqual(["tables"]);
  });

  it("reports a dependency on the module itself", () => {
    expect(getIssuePaths({ ...valid, dependsOn: { auth: "^0.1.0" } })).toEqual(["dependsOn.auth"]);
  });
});
