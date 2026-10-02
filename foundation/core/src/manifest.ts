// The module manifest (docs/02-module-standard.md §3). The TS manifest passed to `defineModule`
// is the source of truth at runtime; `module.json` is its JSON projection (`toModuleJson`),
// checked by the module's own tests, for agents and `softure doctor`.
import { z } from "zod";
import { parseVersionRange } from "./version-range.js";

const MODULE_ID = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const SQL_IDENTIFIER = /^[a-z][a-z0-9_]*$/;
const ENV_NAME = /^[A-Z][A-Z0-9_]*$/;

const envVariableSchema = z.object({
  name: z.string().regex(ENV_NAME, "must be UPPER_SNAKE_CASE"),
  required: z.boolean(),
  description: z.string().min(1),
});

const mountSchema = z.object({
  kind: z.enum(["route-handler", "page", "middleware"]),
  path: z.string().min(1),
  export: z.string().min(1).optional(),
});

export const moduleManifestSchema = z
  .object({
    id: z.string().regex(MODULE_ID, "must be kebab-case"),
    version: z.string().regex(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/, "must be x.y.z"),
    dependsOn: z.record(
      z.string().regex(MODULE_ID, "must be a module id"),
      z.string().refine((range) => parseVersionRange(range).ok, "must be x.y.z, ^x.y.z, ~x.y.z or *, optionally ending in ?"),
    ),
    dbSchema: z.string().regex(SQL_IDENTIFIER, "must be a lower_snake_case identifier").nullable(),
    tables: z.array(z.string().regex(SQL_IDENTIFIER, "must be a lower_snake_case identifier")),
    env: z.array(envVariableSchema),
    switches: z.array(z.string().min(1)),
    routes: z.record(z.string().min(1), z.string().startsWith("/", "must start with /")),
    mount: z.array(mountSchema),
    privacy: z.object({ exports: z.boolean(), deletes: z.boolean() }),
  })
  .superRefine((manifest, context) => {
    if (new Set(manifest.tables).size !== manifest.tables.length) {
      context.addIssue({ code: "custom", path: ["tables"], message: "must not repeat a table" });
    }
    if (manifest.dbSchema === null && manifest.tables.length > 0) {
      context.addIssue({ code: "custom", path: ["tables"], message: "tables need a dbSchema" });
    }
    if (Object.hasOwn(manifest.dependsOn, manifest.id)) {
      context.addIssue({ code: "custom", path: ["dependsOn", manifest.id], message: "a module cannot depend on itself" });
    }
    manifest.switches.forEach((name, index) => {
      if (!name.startsWith(`${manifest.id}.`)) {
        context.addIssue({ code: "custom", path: ["switches", index], message: `must start with "${manifest.id}."` });
      }
    });
  });

export type ModuleManifest = z.output<typeof moduleManifestSchema>;
