import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  defineModule,
  moduleManifestSchema,
  ok,
  SoftureConfigError,
  toModuleJson,
  type ModuleManifest,
} from "@softure-ai/core";

const en = { login: { title: "Sign in", submit: "Continue" } };
const pl: typeof en = { login: { title: "PL title", submit: "PL submit" } };
const migrations = { dir: new URL("../migrations/", import.meta.url) };

const manifest = {
  id: "demo",
  version: "0.1.0",
  dependsOn: {},
  dbSchema: "demo",
  tables: ["items"],
  env: [],
  switches: ["demo.closed"],
  routes: { list: "/demo", afterSave: "/" },
  mount: [],
  privacy: { exports: true, deletes: false },
} satisfies ModuleManifest;

const privacy = { exportUserData: () => Promise.resolve(ok({ items: [] })) };

function defineDemo() {
  return defineModule({
    manifest,
    messages: { en, pl },
    options: z.object({ pageSize: z.number().int().positive().default(20), title: z.string().optional() }),
    migrations,
    privacy,
  });
}

function catchConfigError(run: () => unknown): SoftureConfigError {
  try {
    run();
  } catch (error) {
    if (error instanceof SoftureConfigError) return error;
    throw error;
  }
  throw new Error("expected a SoftureConfigError");
}

describe("defineModule", () => {
  it("exposes the id and the validated manifest on the factory", () => {
    const demo = defineDemo();
    expect(demo.id).toBe("demo");
    expect(demo.manifest).toEqual(manifest);
  });

  it("names the module and the field when the manifest is invalid", () => {
    const error = catchConfigError(() =>
      defineModule({ manifest: { ...manifest, version: "1" }, messages: { en, pl }, migrations, privacy }),
    );
    expect(error.issues).toEqual([expect.stringMatching(/^version: /)]);
    expect(error.message).toContain('module "demo"');
  });

  it("requires migrations when the module has a database schema", () => {
    const error = catchConfigError(() => defineModule({ manifest, messages: { en, pl }, privacy }));
    expect(error.issues).toEqual(["migrations: required because dbSchema is set"]);
  });

  it("requires a file URL for the migrations folder", () => {
    const error = catchConfigError(() =>
      defineModule({ manifest, messages: { en, pl }, privacy, migrations: { dir: new URL("https://example.com/m/") } }),
    );
    expect(error.issues).toEqual(["migrations.dir: must be a file: URL"]);
  });

  it("requires the privacy functions the manifest flags promise, and no others", () => {
    const missing = catchConfigError(() => defineModule({ manifest, messages: { en, pl }, migrations }));
    expect(missing.issues).toEqual(["privacy.exportUserData: required because privacy.exports is true"]);

    const extra = catchConfigError(() =>
      defineModule({
        manifest,
        messages: { en, pl },
        migrations,
        privacy: { ...privacy, deleteUserData: () => Promise.resolve(ok()) },
      }),
    );
    expect(extra.issues).toEqual(["privacy.deleteUserData: given but privacy.deletes is false"]);
  });
});

describe("a module factory", () => {
  it("uses the defaults when called without input", () => {
    const instance = defineDemo()();
    expect(instance.id).toBe("demo");
    expect(instance.routes).toEqual({ list: "/demo", afterSave: "/" });
    expect(instance.messages).toEqual({ en, pl });
    expect(instance.options).toEqual({ pageSize: 20 });
    expect(instance.migrations?.dir.href).toBe(migrations.dir.href);
    expect(instance.privacy?.exportUserData).toBe(privacy.exportUserData);
  });

  it("merges route and message overrides", () => {
    const instance = defineDemo()({
      routes: { afterSave: "/dashboard" },
      messages: { en: { login: { title: "Sign in to Acme" } } },
      pageSize: 50,
    });
    expect(instance.routes).toEqual({ list: "/demo", afterSave: "/dashboard" });
    expect(instance.messages.en.login).toEqual({ title: "Sign in to Acme", submit: "Continue" });
    expect(instance.messages.pl).toEqual(pl);
    expect(instance.options).toEqual({ pageSize: 50 });
  });

  it("lists every invalid option, route and override at once", () => {
    const demo = defineDemo();
    const input = { pageSize: -1, title: 7, routes: { afterSave: "dashboard", unknown: "/x" } } as never;
    const error = catchConfigError(() => demo(input));
    expect(error.message).toContain('module "demo"');
    expect([...error.issues].sort()).toEqual([
      expect.stringMatching(/^options\.pageSize: /),
      expect.stringMatching(/^options\.title: /),
      "routes.afterSave: must start with /",
      "routes.unknown: not a route of this module",
    ]);
  });

  it("works without an options schema", () => {
    const plain = defineModule({
      manifest: { ...manifest, id: "plain", dbSchema: null, tables: [], switches: [], privacy: { exports: false, deletes: false } },
      messages: { en, pl },
    });
    const instance = plain();
    expect(instance.options).toBeUndefined();
    expect(instance.migrations).toBeNull();
    expect(instance.privacy).toBeNull();
    const error = catchConfigError(() => plain({ pageSize: 5 } as never));
    expect(error.issues).toEqual(["options.pageSize: this module takes no options"]);
  });

  it("returns a module whose data cannot be changed afterwards", () => {
    const instance = defineDemo()();
    expect(Object.isFrozen(instance)).toBe(true);
    expect(Object.isFrozen(instance.routes)).toBe(true);
    expect(Object.isFrozen(instance.manifest.tables)).toBe(true);
    expect(Object.isFrozen(instance.messages.en.login)).toBe(true);
  });

  it("does not share the manifest object it was given", () => {
    const input = structuredClone(manifest);
    const factory = defineModule({ manifest: input, messages: { en, pl }, migrations, privacy });
    input.tables.push("leaked");
    expect(factory.manifest.tables).toEqual(["items"]);
  });
});

describe("toModuleJson", () => {
  it("returns the manifest as module.json content that the schema accepts", () => {
    const json: unknown = JSON.parse(JSON.stringify(toModuleJson(defineDemo())));
    expect(moduleManifestSchema.parse(json)).toEqual(manifest);
  });

  it("returns the same content for a factory and for its module", () => {
    const demo = defineDemo();
    expect(toModuleJson(demo())).toEqual(toModuleJson(demo));
  });
});
