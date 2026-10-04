// The language rulesets an app chooses from with `blog({ quality: { language } })`.
import { enRuleset } from "./en/ruleset.js";
import { plRuleset } from "./pl/ruleset.js";
import type { LanguageRuleset, QualityLanguage } from "./types.js";

export const QUALITY_RULESETS: Readonly<Record<QualityLanguage, LanguageRuleset>> = { en: enRuleset, pl: plRuleset };

export { enRuleset, plRuleset };
export { QUALITY_LANGUAGES, type LanguageRuleset, type QualityLanguage, type StylePattern } from "./types.js";
