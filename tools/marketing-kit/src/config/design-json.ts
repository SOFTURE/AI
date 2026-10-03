import { z } from "zod";

import { isHexColor, type ColorTheme, type ColorsResult } from "./colors.js";

/**
 * Brand colours from an Impeccable `design.json` (schemaVersion 2): `themes.<theme>.roles` maps role
 * names to colours. Role names are the project's own (FIRE's include `accessible` and `line-strong`),
 * so the caller names which roles it wants; the rest of the file is documentation and is ignored.
 */

const SUPPORTED_SCHEMA_VERSION = 2;

const designSchema = z.object({
  schemaVersion: z.number(),
  themes: z.record(z.string(), z.unknown()),
});

const themeSchema = z.object({ roles: z.record(z.string(), z.string()) });

export function readDesignJsonColors(input: unknown, names: readonly string[], theme: ColorTheme): ColorsResult {
  const design = designSchema.safeParse(input);
  if (!design.success) return { ok: false, error: "not a design.json: expected schemaVersion and themes" };
  if (design.data.schemaVersion !== SUPPORTED_SCHEMA_VERSION) {
    return { ok: false, error: `schemaVersion ${design.data.schemaVersion} is not supported (expected ${SUPPORTED_SCHEMA_VERSION})` };
  }
  const themed = themeSchema.safeParse(design.data.themes[theme]);
  if (!themed.success) return { ok: false, error: `no themes.${theme}.roles with string values` };
  const { roles } = themed.data;
  const colors: Record<string, string> = {};
  for (const name of names) {
    const value = Object.hasOwn(roles, name) ? roles[name] : undefined;
    if (value === undefined) return { ok: false, error: `no role "${name}" in themes.${theme}.roles` };
    if (!isHexColor(value)) return { ok: false, error: `role "${name}" is "${value}", and the film needs a colour literal (#rrggbb)` };
    colors[name] = value.toLowerCase();
  }
  return { ok: true, colors };
}
