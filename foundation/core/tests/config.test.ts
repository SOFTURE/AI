import { describe, expect, it } from "vitest";
import { defineSoftureConfig, getModule, sortModulesByDependencies, withDatabaseOptional } from "@softure-ai/core";
import { catchConfigError, createTestModule } from "./support.js";

const base = { locale: "pl", timezone: "Europe/Warsaw", appOrigin: "https://app.example.com", modules: [] } as const;

describe("defineSoftureConfig", () => {
  it("accepts a minimal config and fills the database with null", () => {
    const config = defineSoftureConfig(base);
    expect(config).toEqual({ ...base, database: null, origins: { trustedOrigins: [], trustRequestHost: false }, modules: [] });
    expect(Object.isFrozen(config)).toBe(true);
    expect(Object.isFrozen(config.modules)).toBe(true);
  });

  it("keeps a database url and an origin with a port", () => {
    const config = defineSoftureConfig({ ...base, appOrigin: "http://localhost:3000", database: { url: "postgres://db/app" } });
    expect(config.database).toEqual({ url: "postgres://db/app" });
    expect(config.appOrigin).toBe("http://localhost:3000");
  });

  it.each([
    ["locale", { locale: "de" }],
    ["timezone", { timezone: "Mars/Olympus" }],
    ["timezone", { timezone: "" }],
    ["appOrigin", { appOrigin: "https://app.example.com/dashboard" }],
    ["appOrigin", { appOrigin: "ftp://app.example.com" }],
    ["appOrigin", { appOrigin: "app.example.com" }],
    ["modules", { modules: "auth" }],
    ["modules.0", { modules: [{ id: "fake" }] }],
  ])("reports %s when it is invalid", (path, patch) => {
    const error = catchConfigError(() => defineSoftureConfig({ ...base, ...patch } as never));
    expect(error.issues).toEqual([expect.stringMatching(new RegExp(`^${path.replace(".", "\\.")}: `))]);
    expect(error.message).toContain("softure.config");
  });

  it("reports a module listed twice", () => {
    const error = catchConfigError(() =>
      defineSoftureConfig({ ...base, modules: [createTestModule({ id: "auth" }), createTestModule({ id: "auth" })] }),
    );
    expect(error.issues).toEqual(['modules.1: module "auth" is listed twice']);
  });

  it("reports a missing required dependency and accepts a missing optional one", () => {
    const auth = createTestModule({ id: "auth", dependsOn: { security: "^0.1.0", mailing: "^0.1.0?" } });
    const error = catchConfigError(() => defineSoftureConfig({ ...base, modules: [auth] }));
    expect(error.issues).toEqual(['modules.0: module "auth" needs module "security" (^0.1.0), which is not listed']);
  });

  it("reports a dependency listed at a version outside the range, optional or not", () => {
    const auth = createTestModule({ id: "auth", dependsOn: { security: "^0.1.0", mailing: "^0.1.0?" } });
    const security = createTestModule({ id: "security", version: "0.2.0" });
    const mailing = createTestModule({ id: "mailing", version: "1.0.0" });
    const error = catchConfigError(() => defineSoftureConfig({ ...base, modules: [security, mailing, auth] }));
    expect(error.issues).toEqual([
      'modules.2: module "auth" needs module "security" ^0.1.0, but 0.2.0 is listed',
      'modules.2: module "auth" needs module "mailing" ^0.1.0, but 1.0.0 is listed',
    ]);
  });

  it("reports a dependency cycle", () => {
    const first = createTestModule({ id: "first", dependsOn: { second: "*" } });
    const second = createTestModule({ id: "second", dependsOn: { first: "*" } });
    const error = catchConfigError(() => defineSoftureConfig({ ...base, modules: [first, second] }));
    expect(error.issues).toEqual(["modules: dependency cycle between first, second"]);
  });

  it("accepts an empty database url, also with a database schema, and keeps it for the connection to refuse", () => {
    const config = defineSoftureConfig({ ...base, modules: [createTestModule({ id: "auth", dbSchema: "auth" })], database: { url: "" } });

    expect(config.database).toEqual({ url: "" });
    expect(Object.isFrozen(config.database)).toBe(true);
  });

  it("keeps the app's database handle function without calling it", () => {
    let calls = 0;
    const handle = (): never => {
      calls += 1;
      throw new Error("the handle is opened by the first query, not by the config");
    };
    const config = defineSoftureConfig({ ...base, database: { url: "pglite://./data", handle } });
    expect(config.database).toEqual({ url: "pglite://./data", handle });
    expect(config.database?.handle).toBe(handle);
    expect(calls).toBe(0);
  });

  it("refuses a database handle that is not a function", () => {
    const input = { ...base, database: { url: "postgres://db/app", handle: { kind: "postgres" } } };
    // @ts-expect-error -- a handle object instead of a function returning one
    const error = catchConfigError(() => defineSoftureConfig(input));
    expect(error.issues).toEqual(["database.handle: must be a function returning the app's database handle"]);
  });

  it("reports a module with a database schema when the app has no database", () => {
    const error = catchConfigError(() => defineSoftureConfig({ ...base, modules: [createTestModule({ id: "auth", dbSchema: "auth" })] }));
    expect(error.issues).toEqual(['database: required because module "auth" has a database schema']);
  });

  describe("with the database optional (a command that never connects)", () => {
    const withSchema = () => [createTestModule({ id: "auth", dbSchema: "auth" })];

    it.each([
      ["missing", {}],
      ["null", { database: null }],
      ["an empty url", { database: { url: "" } }],
      ["an unset url", { database: { url: undefined } }],
    ])("reads a database that is %s as null, even with a database schema", async (_label, patch) => {
      const config = await withDatabaseOptional(() => defineSoftureConfig({ ...base, modules: withSchema(), ...patch } as never));
      expect(config.database).toBeNull();
    });

    it("keeps a real url", async () => {
      const config = await withDatabaseOptional(() => defineSoftureConfig({ ...base, modules: withSchema(), database: { url: "postgres://db/app" } }));
      expect(config.database).toEqual({ url: "postgres://db/app" });
    });

    it("still reports the other problems", async () => {
      const error = await withDatabaseOptional(() => catchConfigError(() => defineSoftureConfig({ ...base, locale: "de" } as never)));
      expect(error.issues).toEqual([expect.stringMatching(/^locale: /)]);
    });

    it("keeps an empty url as a url again once the load resolves or rejects", async () => {
      await withDatabaseOptional(() => undefined);
      await expect(withDatabaseOptional(() => Promise.reject(new Error("import failed")))).rejects.toThrow("import failed");
      const config = defineSoftureConfig({ ...base, modules: withSchema(), database: { url: "" } });
      expect(config.database).toEqual({ url: "" });
    });
  });

  it("reports two modules sharing a database schema", () => {
    const first = createTestModule({ id: "first", dbSchema: "shared" });
    const second = createTestModule({ id: "second", dbSchema: "shared" });
    const error = catchConfigError(() =>
      defineSoftureConfig({ ...base, database: { url: "postgres://db/app" }, modules: [first, second] }),
    );
    expect(error.issues).toEqual(['modules.1: module "second" uses database schema "shared", already used by module "first"']);
  });

  it("accepts two modules whose routes point at the same path", () => {
    // Route maps also hold redirect targets (`afterLogin: "/"`), so equal paths are legitimate.
    const first = createTestModule({ id: "first", routes: { afterSave: "/" } });
    const second = createTestModule({ id: "second", routes: { afterLogin: "/" } });
    expect(defineSoftureConfig({ ...base, modules: [first, second] }).modules).toHaveLength(2);
  });

  it("lists every problem at once", () => {
    const error = catchConfigError(() => defineSoftureConfig({ ...base, locale: "de", timezone: "Nowhere" } as never));
    expect(error.issues).toHaveLength(2);
  });
});

describe("sortModulesByDependencies", () => {
  it("puts dependencies first and keeps the listed order otherwise", () => {
    const auth = createTestModule({ id: "auth", dependsOn: { security: "*", mailing: "*?" } });
    const billing = createTestModule({ id: "billing", dependsOn: { auth: "*" } });
    const security = createTestModule({ id: "security" });
    const analytics = createTestModule({ id: "analytics" });
    const result = sortModulesByDependencies([billing, analytics, auth, security]);
    expect(result.ok && result.value.map((module) => module.id)).toEqual(["analytics", "security", "auth", "billing"]);
  });

  it("returns an empty list for no modules", () => {
    expect(sortModulesByDependencies([])).toEqual({ ok: true, value: [] });
  });

  it("fails on a cycle", () => {
    const first = createTestModule({ id: "first", dependsOn: { second: "*" } });
    const second = createTestModule({ id: "second", dependsOn: { first: "*" } });
    expect(sortModulesByDependencies([first, second])).toEqual({ ok: false, error: "core.dependency_cycle" });
  });
});

describe("getModule", () => {
  it("finds a listed module by id and returns undefined otherwise", () => {
    const auth = createTestModule({ id: "auth" });
    const config = defineSoftureConfig({ ...base, modules: [auth] });
    expect(getModule(config, "auth")).toBe(auth);
    expect(getModule(config, "billing")).toBeUndefined();
  });
});
