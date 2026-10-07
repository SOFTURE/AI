// The options an app passes to `featureSwitches({ ... })` in softure.config.ts, parsed at startup.
import { LOCALES } from "@softure-ai/core";
import { z } from "zod";

/** `<scope>.<key>`: a kebab-case scope (a module id or the app's own) and a snake_case key. */
export const SWITCH_NAME_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*\.[a-z][a-z0-9_]*$/;
export const MAX_SWITCH_NAME_LENGTH = 100;

/** The same pattern auth enforces for role names. */
const ROLE_NAME_PATTERN = /^[a-z][a-z0-9_-]{0,31}$/;

/** Copy per locale; a locale without its own text falls back to `en`, then to the switch name. */
const localizedTextSchema = z.partialRecord(z.enum(LOCALES), z.string().trim().min(1).max(500));

const switchDefinitionSchema = z.strictObject({
  name: z
    .string()
    .max(MAX_SWITCH_NAME_LENGTH, `must be at most ${String(MAX_SWITCH_NAME_LENGTH)} characters`)
    .regex(SWITCH_NAME_PATTERN, "must be <scope>.<key>, e.g. billing.checkout_enabled"),
  /** The panel's name for the switch. */
  label: localizedTextSchema.optional(),
  /** What turning it on does, shown under the label. */
  description: localizedTextSchema.optional(),
  /** The value while nothing is stored and no environment override is set. Required: no implicit default. */
  default: z.boolean(),
  /** The value when the stored state cannot be read: `closed` reads as off, `open` as on. */
  failMode: z.enum(["open", "closed"]).default("closed"),
  /**
   * Which way the environment override may move the switch. `both`: either value wins over the
   * stored one. `towards-fail-mode`: only the fail-mode value does (on for `open`, off for
   * `closed`), so an override can close but never reopen what an admin closed; the other value is
   * ignored and logged once by variable name.
   */
  override: z.enum(["both", "towards-fail-mode"]).default("both"),
});

export const featureSwitchesOptionsSchema = z
  .strictObject({
    /** Every switch the app reads, including the ones its modules name in their manifests. */
    switches: z.array(switchDefinitionSchema).default([]),
    /** The auth role that may open the panel and flip switches. */
    panelRole: z.string().regex(ROLE_NAME_PATTERN, "must be a role name such as admin").default("admin"),
  })
  .superRefine((options, context) => {
    const names = new Map<string, number>();
    const envNames = new Map<string, string>();
    options.switches.forEach((definition, index) => {
      if (names.has(definition.name)) {
        context.addIssue({ code: "custom", path: ["switches", index, "name"], message: `"${definition.name}" is declared twice` });
        return;
      }
      names.set(definition.name, index);
      const envName = getSwitchEnvName(definition.name);
      const other = envNames.get(envName);
      if (other !== undefined) {
        context.addIssue({
          code: "custom",
          path: ["switches", index, "name"],
          message: `its environment override ${envName} is also the one of "${other}"`,
        });
      }
      envNames.set(envName, definition.name);
    });
  });

export type FeatureSwitchesOptionsInput = z.input<typeof featureSwitchesOptionsSchema>;
export type FeatureSwitchesOptions = z.output<typeof featureSwitchesOptionsSchema>;
export type SwitchDefinitionInput = z.input<typeof switchDefinitionSchema>;
export type SwitchDefinition = z.output<typeof switchDefinitionSchema>;
export type SwitchFailMode = SwitchDefinition["failMode"];
export type SwitchOverrideDirection = SwitchDefinition["override"];

/** The environment variable that overrides a switch: `billing.checkout_enabled` → `SOFTURE_SWITCH_BILLING_CHECKOUT_ENABLED`. */
export function getSwitchEnvName(name: string): string {
  return `SOFTURE_SWITCH_${name.toUpperCase().replace(/[.-]/g, "_")}`;
}
