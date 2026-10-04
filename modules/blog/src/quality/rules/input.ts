// What every built-in rule reads.
import type { BlogArticleInput } from "../../contract.js";
import type { Block } from "../blocks.js";
import type { QualitySettings } from "../settings.js";

export interface RuleInput {
  readonly article: BlogArticleInput;
  readonly blocks: readonly Block[];
  readonly settings: QualitySettings;
  /** `YYYY-MM-DD` in the app's time zone. */
  readonly today: string;
}
