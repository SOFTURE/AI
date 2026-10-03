// The app configuration (docs/02-module-standard.md §7): one `softure.config.ts` per app, validated
// at startup. A module is enabled by being listed in `modules`.
import { z } from "zod";
import { formatIssues, SoftureConfigError } from "./config-error.js";
import { LOCALES, type Locale } from "./i18n.js";
import type { AnySoftureModule } from "./module.js";
import { err, ok, type Result } from "./result.js";
import { parseVersionRange, satisfiesRange } from "./version-range.js";

export interface SoftureConfig {
  /** `null` when the app has no database; required as soon as a module has a `dbSchema`. */
  readonly database: { readonly url: string } | null;
  readonly locale: Locale;
  /** IANA time zone used for every date shown or computed per calendar day. */
  readonly timezone: string;
  /** Scheme, host and port of the app, without a path: `https://app.example.com`. */
  readonly appOrigin: string;
  /** Enabled modules, in the order the app listed them. */
  readonly modules: readonly AnySoftureModule[];
}

/** What the app writes in `softure.config.ts`. */
export interface SoftureConfigInput {
  readonly database?: { readonly url: string } | null;
  readonly locale: Locale;
  readonly timezone: string;
  readonly appOrigin: string;
  readonly modules: readonly AnySoftureModule[];
}

const CONFIG_SUBJECT = "softure.config (defineSoftureConfig)";

const configSchema = z.object({
  database: z
    .object({ url: z.string().min(1, "must not be empty") })
    .nullable()
    .default(null),
  locale: z.enum(LOCALES),
  timezone: z.string().refine(isTimeZone, "must be an IANA time zone, e.g. Europe/Warsaw"),
  appOrigin: z.string().refine(isOrigin, "must be an http(s) origin without a path, e.g. https://app.example.com"),
  modules: z.array(z.custom<AnySoftureModule>(isSoftureModule, "must be a module returned by a module factory")),
});

/**
 * Validates the app configuration and returns it frozen. Throws `SoftureConfigError` listing
 * every problem: an app with an invalid configuration must not start.
 */
export function defineSoftureConfig(input: SoftureConfigInput): SoftureConfig {
  const result = configSchema.safeParse(input);
  if (!result.success) {
    throw new SoftureConfigError(CONFIG_SUBJECT, formatIssues(result.error.issues));
  }

  const config = result.data;
  const issues = [...checkModules(config.modules), ...checkDatabase(config)];
  if (issues.length > 0) {
    throw new SoftureConfigError(CONFIG_SUBJECT, issues);
  }

  return Object.freeze({
    ...config,
    database: config.database === null ? null : Object.freeze({ ...config.database }),
    modules: Object.freeze([...config.modules]),
  });
}

/** The enabled module with this id, or `undefined` when the app did not list it. */
export function getModule(config: SoftureConfig, id: string): AnySoftureModule | undefined {
  return config.modules.find((module) => module.id === id);
}

/**
 * The modules with every listed dependency before its dependents (the migration order); ties
 * keep the listed order. Dependencies that are not listed are ignored here.
 */
export function sortModulesByDependencies(
  modules: readonly AnySoftureModule[],
): Result<AnySoftureModule[], "core.dependency_cycle"> {
  const sorted = orderModules(modules);
  return sorted.remaining.length === 0 ? ok(sorted.ordered) : err("core.dependency_cycle");
}

function orderModules(modules: readonly AnySoftureModule[]): { ordered: AnySoftureModule[]; remaining: AnySoftureModule[] } {
  const listedIds = new Set(modules.map((module) => module.id));
  const placedIds = new Set<string>();
  const ordered: AnySoftureModule[] = [];
  let remaining = [...modules];

  for (;;) {
    const next = remaining.find((module) =>
      Object.keys(module.manifest.dependsOn).every((id) => !listedIds.has(id) || placedIds.has(id)),
    );
    if (next === undefined) {
      return { ordered, remaining };
    }
    ordered.push(next);
    placedIds.add(next.id);
    remaining = remaining.filter((module) => module !== next);
  }
}

function checkModules(modules: readonly AnySoftureModule[]): string[] {
  const issues: string[] = [];
  const byId = new Map<string, AnySoftureModule>();
  const schemaOwners = new Map<string, string>();

  modules.forEach((module, index) => {
    if (byId.has(module.id)) {
      issues.push(`modules.${index}: module "${module.id}" is listed twice`);
      return;
    }
    byId.set(module.id, module);

    const schema = module.manifest.dbSchema;
    const owner = schema === null ? undefined : schemaOwners.get(schema);
    if (schema !== null && owner !== undefined) {
      issues.push(`modules.${index}: module "${module.id}" uses database schema "${schema}", already used by module "${owner}"`);
    } else if (schema !== null) {
      schemaOwners.set(schema, module.id);
    }
  });

  modules.forEach((module, index) => {
    for (const [dependencyId, rangeText] of Object.entries(module.manifest.dependsOn)) {
      const issue = checkDependency(module.id, dependencyId, rangeText, byId.get(dependencyId));
      if (issue !== null) {
        issues.push(`modules.${index}: ${issue}`);
      }
    }
  });

  const providers = modules.filter((module) => typeof module.switchReader === "function").map((module) => module.id);
  if (providers.length > 1) {
    issues.push(`modules: only one module may provide the switch reader; ${providers.join(", ")} all do`);
  }

  const { remaining } = orderModules([...byId.values()]);
  if (remaining.length > 0) {
    issues.push(`modules: dependency cycle between ${remaining.map((module) => module.id).join(", ")}`);
  }
  return issues;
}

function checkDependency(
  moduleId: string,
  dependencyId: string,
  rangeText: string,
  dependency: AnySoftureModule | undefined,
): string | null {
  const range = parseVersionRange(rangeText);
  if (!range.ok) {
    // The manifest schema already rejected it; unreachable for a module built by defineModule.
    return `module "${moduleId}" has an invalid range for "${dependencyId}": ${rangeText}`;
  }
  const required = rangeText.replace(/\?$/, "");
  if (dependency === undefined) {
    return range.value.optional ? null : `module "${moduleId}" needs module "${dependencyId}" (${required}), which is not listed`;
  }
  if (!satisfiesRange(dependency.manifest.version, range.value)) {
    return `module "${moduleId}" needs module "${dependencyId}" ${required}, but ${dependency.manifest.version} is listed`;
  }
  return null;
}

function checkDatabase(config: { database: unknown; modules: readonly AnySoftureModule[] }): string[] {
  if (config.database !== null) {
    return [];
  }
  return config.modules
    .filter((module) => module.manifest.dbSchema !== null)
    .map((module) => `database: required because module "${module.id}" has a database schema`);
}

function isTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return value !== "";
  } catch {
    return false;
  }
}

function isOrigin(value: string): boolean {
  if (!URL.canParse(value)) {
    return false;
  }
  const url = new URL(value);
  return (url.protocol === "https:" || url.protocol === "http:") && url.origin === value;
}

function isSoftureModule(value: unknown): value is AnySoftureModule {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Partial<Record<keyof AnySoftureModule, unknown>>;
  return typeof candidate.id === "string" && typeof candidate.manifest === "object" && candidate.manifest !== null;
}
