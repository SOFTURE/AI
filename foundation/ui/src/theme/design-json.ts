// Import of an Impeccable `design.json` (schemaVersion 2, as in FIRE_TRACKER's
// `.impeccable/design.json`): `themes.{light,dark}.roles` map role names to colours. Only the
// roles of the token contract are taken; the rest is reported, not fatal.
import { err, ok, type Result } from "@softure-ai/core";
import { z } from "zod";
import { isSafeTokenValue } from "./theme-css.js";
import type { ColorScheme, SchemeTokenName, SchemeTokens, SoftureTheme } from "./tokens.js";

export type DesignJsonError = "ui.design_json_invalid" | "ui.design_json_unsupported_version";

export interface DesignJsonTheme {
  readonly theme: SoftureTheme;
  /** Roles outside the contract, as `<scheme>.<role>`. */
  readonly ignoredRoles: readonly string[];
}

/** design.json role -> token. `line-strong` is FIRE's name for the strong border. */
const ROLE_TOKENS: Readonly<Record<string, SchemeTokenName>> = {
  background: "color-background",
  surface: "color-surface",
  "surface-raised": "color-surface-raised",
  foreground: "color-foreground",
  muted: "color-muted",
  border: "color-border",
  "border-strong": "color-border-strong",
  "line-strong": "color-border-strong",
  accent: "color-accent",
  "accent-fill": "color-accent-fill",
  "accent-fill-hover": "color-accent-fill-hover",
  "on-accent": "color-on-accent",
  danger: "color-danger",
  success: "color-success",
  warning: "color-warning",
  focus: "color-focus",
};

const SUPPORTED_SCHEMA_VERSION = 2;

const schemeSchema = z.object({ roles: z.record(z.string(), z.string().refine(isSafeTokenValue)) });

const designSchema = z.object({
  schemaVersion: z.number(),
  themes: z.object({ light: schemeSchema.optional(), dark: schemeSchema.optional() }),
});

/** The theme a `design.json` value describes. The input is untrusted: parsed, never cast. */
export function themeFromDesignJson(input: unknown): Result<DesignJsonTheme, DesignJsonError> {
  const version = z.object({ schemaVersion: z.number() }).safeParse(input);
  if (version.success && version.data.schemaVersion !== SUPPORTED_SCHEMA_VERSION) {
    return err("ui.design_json_unsupported_version");
  }
  const parsed = designSchema.safeParse(input);
  if (!parsed.success) return err("ui.design_json_invalid");

  const theme: { light?: Partial<SchemeTokens>; dark?: Partial<SchemeTokens> } = {};
  const ignoredRoles: string[] = [];
  for (const scheme of ["light", "dark"] as const satisfies readonly ColorScheme[]) {
    const roles = parsed.data.themes[scheme]?.roles;
    if (!roles) continue;
    const tokens: Partial<Record<SchemeTokenName, string>> = {};
    for (const [role, value] of Object.entries(roles)) {
      const token = Object.hasOwn(ROLE_TOKENS, role) ? ROLE_TOKENS[role] : undefined;
      if (token) {
        tokens[token] = value;
      } else {
        ignoredRoles.push(`${scheme}.${role}`);
      }
    }
    theme[scheme] = tokens;
  }
  return ok({ theme, ignoredRoles });
}
