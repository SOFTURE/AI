import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { COLOR_ROLES, getDefaultToken, isOpaqueHexColor, type BrandColors, type ColorsResult } from "./colors.js";
import { readCssColors } from "./css-colors.js";
import { readDesignJsonColors } from "./design-json.js";
import type { ConfigIssue } from "./issues.js";
import type { MarketingJson } from "./schema.js";

/**
 * The brand's colours, every role resolved: a value in `brand.colors` wins; otherwise the role reads
 * its token (its own kebab name, or the one `tokensFrom.roles` names) from the app's stylesheet or
 * from a design.json. An unresolved role is an error at `brand.colors.<role>`, never a default
 * colour: a film in someone else's palette is worse than no film.
 */

export type BrandColorsResult = { ok: true; colors: BrandColors } | { ok: false; issues: ConfigIssue[] };

type Brand = MarketingJson["brand"];
type TokenReader = (names: readonly string[]) => ColorsResult;

function getErrorCode(error: unknown): string {
  return (error as NodeJS.ErrnoException).code ?? String(error);
}

/** The reader of the configured source, or the issue that stops it from being read. */
function openSource(brand: Brand, root: string): { reader: TokenReader | null; issue: ConfigIssue | null } {
  const source = brand.tokensFrom;
  if (source === undefined) return { reader: null, issue: null };
  const key = source.css === undefined ? "designJson" : "css";
  // The schema accepts exactly one of the two.
  const relative = (source.css ?? source.designJson) as string;
  const file = resolve(root, relative);
  const path = ["brand", "tokensFrom", key];
  let text: string;
  try {
    text = readFileSync(file, "utf8");
  } catch (error) {
    return { reader: null, issue: { path, message: `cannot read ${file}: ${getErrorCode(error)}` } };
  }
  if (key === "css") return { reader: (names) => readCssColors(text, names, source.theme), issue: null };
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (error) {
    return { reader: null, issue: { path, message: `${file} is not JSON (${error instanceof Error ? error.message : String(error)})` } };
  }
  return { reader: (names) => readDesignJsonColors(json, names, source.theme), issue: null };
}

export function resolveBrandColors(brand: Brand, root: string): BrandColorsResult {
  const { reader, issue } = openSource(brand, root);
  if (issue !== null) return { ok: false, issues: [issue] };
  const issues: ConfigIssue[] = [];
  const colors: Partial<BrandColors> = {};
  for (const role of COLOR_ROLES) {
    const inline = brand.colors[role];
    if (inline !== undefined) {
      colors[role] = inline.toLowerCase();
      continue;
    }
    const path = ["brand", "colors", role];
    if (reader === null) {
      issues.push({ path, message: "is required (set it here, or read it from a source with brand.tokensFrom)" });
      continue;
    }
    const token = brand.tokensFrom?.roles[role] ?? getDefaultToken(role);
    const read = reader([token]);
    const value = read.ok ? read.colors[token] : undefined;
    if (value === undefined) {
      const reason = read.ok ? `no colour for "${token}"` : read.error;
      issues.push({ path, message: `not set, and brand.tokensFrom has no colour for it: ${reason}. Set it here or map it with brand.tokensFrom.roles.${role}` });
      continue;
    }
    colors[role] = value;
  }
  if (colors.background !== undefined && !isOpaqueHexColor(colors.background)) {
    issues.push({ path: ["brand", "colors", "background"], message: `"${colors.background}" must be #rrggbb: the vignette adds its own transparency` });
  }
  if (issues.length > 0) return { ok: false, issues };
  // Every role either got a colour above or left an issue, so none is missing here.
  return { ok: true, colors: colors as BrandColors };
}
