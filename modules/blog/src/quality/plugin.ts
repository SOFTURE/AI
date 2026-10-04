// The rule plugin API: an app adds its domain rules (FIRE: legal figures equal the engine's, numbers
// next to a chart stand in its table) to `blog({ quality: { plugins } })`.
import type { BlogArticleInput } from "../contract.js";
import type { Block } from "./blocks.js";
import type { QualityFinding, QualitySeverity } from "./finding.js";
import type { LanguageRuleset } from "./rulesets/types.js";

/** A rule as the catalog lists it: what the writing skill names and the gate enforces. */
export interface QualityRuleInfo {
  readonly id: string;
  /** The default severity; `quality.severity` overrides it. */
  readonly severity: QualitySeverity;
  readonly description: string;
}

export interface QualityPluginContext {
  /** The parsed file: frontmatter values, the app's `fields` and the Markdown body. */
  readonly article: BlogArticleInput;
  /** The body cut into blocks with file lines; directives (`::name{…}`) are blocks of their own. */
  readonly blocks: readonly Block[];
  /** `YYYY-MM-DD` in the app's time zone. */
  readonly today: string;
  /** The app's language ruleset, for its number notation. */
  readonly ruleset: LanguageRuleset;
}

export interface QualityPlugin {
  /** Names the plugin in a failure message. */
  readonly name: string;
  /** Every rule id the plugin may report. A finding with another id is refused as `plugin-rule-undeclared`. */
  readonly rules: readonly QualityRuleInfo[];
  /** Pure: no network, no file system. A throw becomes a `plugin-failed` error. */
  readonly check: (context: QualityPluginContext) => readonly QualityFinding[];
}

export function isQualityPlugin(value: unknown): value is QualityPlugin {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as { name?: unknown; rules?: unknown; check?: unknown };
  return typeof candidate.name === "string" && Array.isArray(candidate.rules) && typeof candidate.check === "function";
}
