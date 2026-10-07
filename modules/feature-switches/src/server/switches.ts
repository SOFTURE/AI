// Reading and setting switches. A switch's value is, in this order: its environment override, the
// value an admin stored, its declared default. When the stored state cannot be read (or the
// override is not a boolean) the switch takes its fail mode: `closed` reads as off, `open` as on.
// A switch declared with `override: "towards-fail-mode"` takes only the fail-mode value from its
// override and reads on as if the variable were unset for the other.
import { err, errorLogLabel, ok, type Err, type ModuleContext, type Ok } from "@softure-ai/core";
import type { Queryable } from "@softure-ai/db";
import { eq } from "drizzle-orm";
import type { SwitchSource, SwitchView } from "../contract.js";
import { getSwitchEnvName, type SwitchDefinition } from "../options.js";
import { switches } from "../schema.js";
import { readEnvOverride, reportIgnoredOverride, type Env } from "./env-override.js";
import { findSwitchDefinition, getLocalizedText, getSwitchDefinition, getSwitchDefinitions } from "./options.js";

export type SwitchContext = ModuleContext<Queryable>;

/** A stored row. */
export interface StoredSwitch {
  readonly isEnabled: boolean;
  readonly updatedAt: Date;
  readonly updatedBy: string | null;
}

/** The stored rows by name, or the failure to read them. */
export type StoredSwitches = Ok<ReadonlyMap<string, StoredSwitch>> | Err<"core.database_failed">;

export interface SwitchValue {
  readonly isEnabled: boolean;
  readonly source: SwitchSource;
}

export interface SetSwitchInput {
  readonly name: string;
  readonly isEnabled: boolean;
  /** The auth user id of whoever sets it; null for an operator outside a session. */
  readonly actorId: string | null;
}

function toStoredMap(rows: readonly (typeof switches.$inferSelect)[]): ReadonlyMap<string, StoredSwitch> {
  return new Map(rows.map((row) => [row.name, { isEnabled: row.enabled, updatedAt: row.updatedAt, updatedBy: row.updatedBy }]));
}

/**
 * The stored rows of `names` (every row when omitted). A database failure is logged and returned as
 * a value, so the callers can fall back to each switch's fail mode instead of failing the request.
 */
export async function readStoredSwitches(ctx: SwitchContext, names?: readonly string[]): Promise<StoredSwitches> {
  try {
    const query = ctx.db.select().from(switches);
    const rows = names?.length === 1 && names[0] !== undefined ? await query.where(eq(switches.name, names[0])) : await query;
    return ok(toStoredMap(rows));
  } catch (error) {
    console.error(`@softure-ai/feature-switches: reading switches failed: ${errorLogLabel(error)}`);
    return err("core.database_failed");
  }
}

/** The value of one declared switch from its override, its stored row and its definition. */
export function resolveSwitchValue(definition: SwitchDefinition, stored: StoredSwitches, env: Env): SwitchValue {
  const failValue: SwitchValue = { isEnabled: definition.failMode === "open", source: "fail-mode" };
  const override = readEnvOverride(definition.name, env);
  if (override.kind === "set" && isOverrideAllowed(definition, override.isEnabled)) return { isEnabled: override.isEnabled, source: "env" };
  if (override.kind === "set") reportIgnoredOverride(definition.name, failValue.isEnabled);
  if (override.kind === "invalid") return failValue;
  if (!stored.ok) return failValue;
  const row = stored.value.get(definition.name);
  return row === undefined ? { isEnabled: definition.default, source: "default" } : { isEnabled: row.isEnabled, source: "stored" };
}

function isOverrideAllowed(definition: SwitchDefinition, isEnabled: boolean): boolean {
  return definition.override === "both" || isEnabled === (definition.failMode === "open");
}

/** Whether a declared switch is on. Throws for an undeclared name; never throws on a database failure. */
export async function isEnabled(ctx: SwitchContext, name: string, env: Env = process.env): Promise<boolean> {
  const definition = getSwitchDefinition(ctx.config, name);
  return resolveSwitchValue(definition, await readStoredSwitches(ctx, [name]), env).isEnabled;
}

/** Every declared switch as the panel shows it, in the order the app declared them. */
export async function listSwitches(ctx: SwitchContext, env: Env = process.env): Promise<SwitchView[]> {
  const stored = await readStoredSwitches(ctx);
  const locale = ctx.config.locale;
  return getSwitchDefinitions(ctx.config).map((definition) => {
    const value = resolveSwitchValue(definition, stored, env);
    const row = stored.ok ? stored.value.get(definition.name) : undefined;
    return {
      name: definition.name,
      label: getLocalizedText(definition.label, locale, definition.name),
      description: definition.description === undefined ? null : getLocalizedText(definition.description, locale, ""),
      isEnabled: value.isEnabled,
      source: value.source,
      envName: getSwitchEnvName(definition.name),
      updatedAt: row?.updatedAt ?? null,
      updatedBy: row?.updatedBy ?? null,
    };
  });
}

/**
 * Stores a declared switch's value with when and by whom. An environment override, while set, still
 * wins over it. Database failures propagate.
 */
export async function setSwitch(ctx: SwitchContext, input: SetSwitchInput): Promise<Ok<undefined> | Err<"feature-switches.unknown_switch">> {
  if (findSwitchDefinition(ctx.config, input.name) === undefined) return err("feature-switches.unknown_switch");
  const values = { enabled: input.isEnabled, updatedAt: ctx.clock.now(), updatedBy: input.actorId };
  await ctx.db
    .insert(switches)
    .values({ name: input.name, ...values })
    .onConflictDoUpdate({ target: switches.name, set: values });
  return ok();
}
