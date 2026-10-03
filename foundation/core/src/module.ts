// The module contract (docs/02-module-standard.md §2, §3, §9). A module package calls
// `defineModule` once; the app enables the module by calling the returned factory inside
// `defineSoftureConfig({ modules: [...] })`, with options, route and message overrides.
import type { z } from "zod";
import type { Clock } from "./clock.js";
import type { SoftureConfig } from "./config.js";
import { formatIssues, SoftureConfigError } from "./config-error.js";
import { mergeMessages, type Dictionaries, type MessageOverrides, type MessageTree } from "./i18n.js";
import { moduleManifestSchema, type ModuleManifest } from "./manifest.js";
import type { Result } from "./result.js";
import type { SwitchReader } from "./switches.js";

/** What every server function of a module receives; it never reads request scope. */
export interface ModuleContext<TDatabase = unknown> {
  /** Typed by `@softure-ai/db`. */
  readonly db: TDatabase;
  readonly clock: Clock;
  readonly config: SoftureConfig;
}

/**
 * A module's part of a GDPR export and deletion. Each function must be present exactly when the
 * matching manifest flag (`privacy.exports`, `privacy.deletes`) is true.
 */
export interface PrivacyContributor {
  readonly exportUserData?: (context: ModuleContext, userId: string) => Promise<Result<unknown>>;
  readonly deleteUserData?: (context: ModuleContext, userId: string) => Promise<Result<undefined>>;
}

/**
 * A module's readiness probe, run by `GET /api/health` of `@softure-ai/ops` for every enabled
 * module that has one. `ok()` means the module can serve; an `Err` or a throw marks the app
 * unavailable. Keep it cheap: it runs on every probe.
 */
export type HealthCheck = (context: ModuleContext) => Promise<Result<undefined>>;

export interface ModuleMigrations {
  /** The folder with the module's SQL files: `resolveMigrationsDir(import.meta.url, "../migrations/")`. */
  readonly dir: URL;
}

/**
 * The URL of a module's migrations folder, relative to the file that calls it:
 * `migrations: { dir: resolveMigrationsDir(import.meta.url, "../migrations/") }`.
 *
 * Write this instead of `new URL("../migrations/", import.meta.url)`: bundlers (Next.js Turbopack)
 * treat that literal form as an asset import and fail the app's build on a folder. Only
 * `softure migrate` reads the folder, under plain Node, where both forms give the same URL.
 */
export function resolveMigrationsDir(moduleUrl: string | URL, relativePath: string): URL {
  return new URL(relativePath, moduleUrl);
}

type RouteMap = Readonly<Record<string, string>>;

export interface ModuleSpec<TRoutes extends RouteMap, TMessages extends MessageTree, TSchema extends z.ZodType | undefined> {
  readonly manifest: ModuleManifest & { readonly routes: TRoutes };
  /** Complete default dictionaries. */
  readonly messages: Dictionaries<TMessages>;
  /** Schema of the module's own options; the app's input is parsed with it. */
  readonly options?: TSchema;
  /** Required when the manifest has a `dbSchema`. */
  readonly migrations?: ModuleMigrations;
  readonly privacy?: PrivacyContributor;
  readonly health?: HealthCheck;
  /** Makes this module the app's switch provider (`readSwitch`); at most one enabled module may. */
  readonly switchReader?: SwitchReader;
}

type OptionsInput<TSchema> = TSchema extends z.ZodType ? z.input<TSchema> : object;
type OptionsOutput<TSchema> = TSchema extends z.ZodType ? z.output<TSchema> : undefined;

/** What the app passes to a module factory: the module's options plus two reserved keys. */
export type ModuleInput<TRoutes extends RouteMap, TMessages extends MessageTree, TSchema> = OptionsInput<TSchema> & {
  /** New paths for some of the module's routes. */
  readonly routes?: Partial<Record<keyof TRoutes & string, string>>;
  /** Partial copy overrides per locale. */
  readonly messages?: MessageOverrides<TMessages>;
};

/** An enabled, configured module, as listed in `SoftureConfig.modules`. */
export interface SoftureModule<TRoutes extends RouteMap = RouteMap, TMessages extends MessageTree = MessageTree, TOptions = unknown> {
  readonly id: string;
  readonly manifest: ModuleManifest;
  readonly routes: Readonly<Record<keyof TRoutes & string, string>>;
  readonly messages: Dictionaries<TMessages>;
  readonly options: TOptions;
  readonly migrations: ModuleMigrations | null;
  readonly privacy: PrivacyContributor | null;
  readonly health: HealthCheck | null;
  readonly switchReader: SwitchReader | null;
}

export type AnySoftureModule = SoftureModule<RouteMap, MessageTree, unknown>;

export interface ModuleFactory<TRoutes extends RouteMap, TMessages extends MessageTree, TSchema> {
  (input?: ModuleInput<TRoutes, TMessages, TSchema>): SoftureModule<TRoutes, TMessages, OptionsOutput<TSchema>>;
  readonly id: string;
  readonly manifest: ModuleManifest;
}

/**
 * Validates a module's definition and returns the factory the app calls to enable it.
 * Throws `SoftureConfigError` when the definition is invalid: that is a bug in the module package.
 */
export function defineModule<TRoutes extends RouteMap, TMessages extends MessageTree, TSchema extends z.ZodType | undefined = undefined>(
  spec: ModuleSpec<TRoutes, TMessages, TSchema>,
): ModuleFactory<TRoutes, TMessages, TSchema> {
  const manifest = parseManifest(spec.manifest);
  const issues = [
    ...checkMigrations(manifest, spec.migrations),
    ...checkPrivacy(manifest, spec.privacy),
    ...checkFunction("health", spec.health),
    ...checkFunction("switchReader", spec.switchReader),
  ];
  if (issues.length > 0) {
    throw new SoftureConfigError(`module "${manifest.id}"`, issues);
  }

  const migrations = spec.migrations === undefined ? null : Object.freeze({ dir: new URL(spec.migrations.dir.href) });
  const privacy = spec.privacy === undefined ? null : Object.freeze({ ...spec.privacy });
  const health = spec.health ?? null;
  const switchReader = spec.switchReader ?? null;

  const factory = (input: ModuleInput<TRoutes, TMessages, TSchema> = {} as ModuleInput<TRoutes, TMessages, TSchema>) => {
    const { routes: routeOverrides, messages: messageOverrides, ...optionsInput } = input;
    const inputIssues: string[] = [];

    const routes = mergeRoutes(manifest.routes, routeOverrides, inputIssues);
    const options = parseOptions(spec.options, optionsInput, inputIssues);
    if (inputIssues.length > 0) {
      throw new SoftureConfigError(`module "${manifest.id}"`, inputIssues);
    }

    const module: SoftureModule<TRoutes, TMessages, OptionsOutput<TSchema>> = {
      id: manifest.id,
      manifest,
      routes: deepFreeze(routes) as Record<keyof TRoutes & string, string>,
      messages: deepFreeze(mergeMessages(spec.messages, messageOverrides)),
      options: options as OptionsOutput<TSchema>,
      migrations,
      privacy,
      health,
      switchReader,
    };
    return Object.freeze(module);
  };

  return Object.assign(factory, { id: manifest.id, manifest });
}

/** The content of a module's `module.json`: its manifest as plain JSON. */
export function toModuleJson(source: { readonly manifest: ModuleManifest }): ModuleManifest {
  return structuredClone(source.manifest);
}

function parseManifest(input: ModuleManifest): ModuleManifest {
  const result = moduleManifestSchema.safeParse(input);
  if (!result.success) {
    const subject = typeof input.id === "string" ? `module "${input.id}"` : "a module manifest";
    throw new SoftureConfigError(subject, formatIssues(result.error.issues));
  }
  return deepFreeze(structuredClone(result.data));
}

function checkFunction(key: string, value: unknown): string[] {
  return value === undefined || typeof value === "function" ? [] : [`${key}: must be a function`];
}

function checkMigrations(manifest: ModuleManifest, migrations: ModuleMigrations | undefined): string[] {
  if (migrations === undefined) {
    return manifest.dbSchema === null ? [] : ["migrations: required because dbSchema is set"];
  }
  return migrations.dir.protocol === "file:" ? [] : ["migrations.dir: must be a file: URL"];
}

function checkPrivacy(manifest: ModuleManifest, privacy: PrivacyContributor | undefined): string[] {
  const issues: string[] = [];
  const pairs = [
    ["exports", "exportUserData", manifest.privacy.exports, privacy?.exportUserData],
    ["deletes", "deleteUserData", manifest.privacy.deletes, privacy?.deleteUserData],
  ] as const;
  for (const [flag, method, isPromised, implementation] of pairs) {
    if (isPromised && implementation === undefined) {
      issues.push(`privacy.${method}: required because privacy.${flag} is true`);
    }
    if (!isPromised && implementation !== undefined) {
      issues.push(`privacy.${method}: given but privacy.${flag} is false`);
    }
  }
  return issues;
}

function mergeRoutes(defaults: RouteMap, overrides: Readonly<Record<string, unknown>> | undefined, issues: string[]): Record<string, string> {
  const routes = { ...defaults };
  for (const [name, path] of Object.entries(overrides ?? {})) {
    if (!Object.hasOwn(defaults, name)) {
      issues.push(`routes.${name}: not a route of this module`);
    } else if (typeof path !== "string" || !path.startsWith("/")) {
      issues.push(`routes.${name}: must start with /`);
    } else {
      routes[name] = path;
    }
  }
  return routes;
}

function parseOptions(schema: z.ZodType | undefined, input: unknown, issues: string[]): unknown {
  if (schema === undefined) {
    // Without a schema the module takes no options: a stray key is a typo, not something to drop.
    for (const key of Object.keys(input as object)) {
      issues.push(`options.${key}: this module takes no options`);
    }
    return undefined;
  }
  const result = schema.safeParse(input);
  if (!result.success) {
    issues.push(...formatIssues(result.error.issues, "options"));
    return undefined;
  }
  return result.data;
}

/** Freezes plain data (objects and arrays) at every depth. */
function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) {
      deepFreeze(child);
    }
    Object.freeze(value);
  }
  return value;
}
