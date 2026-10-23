// The voice check for copy that is not an article (#690): landing and calculator text, posts pasted into
// forums and social networks, list mails. The ruleset's patterns, the app's voice and the rhythm rules over
// plain paragraphs, without frontmatter, structure, links or facts.
import { getProseBlocks, splitBlocks } from "./blocks.js";
import type { QualityFinding } from "./finding.js";
import { qualityOptionsSchema, type QualityOptionsInput } from "./options.js";
import { checkChannelMarkup, checkDashPivots, checkPostAsides } from "./rules/copy.js";
import { checkRhythm, getActivePatterns, matchPatterns } from "./rules/style.js";
import { applySeverity, resolveStyleSettings } from "./settings.js";

/** `copy`: text shown as written (UI copy, a mail). `channel`: text pasted into a plain-text editor, where markdown is noise. */
export const COPY_MODES = ["copy", "channel"] as const;
export type CopyMode = (typeof COPY_MODES)[number];

export interface CheckCopyTextOptions {
  /** Default: `copy`. */
  readonly mode?: CopyMode;
  /**
   * The same options the app gives `blog({ quality })`: `language`, `voice`, `ymyl`, `limits` and `severity`
   * apply; the keys that need an article (paths, facts, blocks, plugins) do not. Invalid options throw.
   */
  readonly quality?: QualityOptionsInput;
}

export interface CopyCheckResult {
  /** Lines count from 1 in the text given. */
  readonly findings: readonly QualityFinding[];
}

/** Bold rules of articles; in channel mode every bold is already `channel-markup`. */
const BOLD_RULES: ReadonlySet<string> = new Set(["bold-density", "bold-labels"]);

/** Rules whose finding is stricter in copy than in an article: one tell weighs more in a short text. */
const COPY_SEVERITY: Readonly<Record<string, QualityFinding["severity"]>> = { "stacked-asides": "error" };

export function checkCopyText(text: string, options: CheckCopyTextOptions = {}): CopyCheckResult {
  const settings = resolveStyleSettings(qualityOptionsSchema.parse(options.quality ?? {}));
  const blocks = splitBlocks(text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n"));
  const patterns = getActivePatterns({ settings }).map((pattern) => ({ ...pattern, severity: pattern.copySeverity ?? pattern.severity }));
  const findings = [
    ...(options.mode === "channel" ? checkChannelMarkup(text) : []),
    ...matchPatterns(getProseBlocks(blocks), patterns),
    ...checkRhythm({ blocks, settings })
      .filter((finding) => options.mode !== "channel" || !BOLD_RULES.has(finding.rule))
      .map((finding) => ({ ...finding, severity: COPY_SEVERITY[finding.rule] ?? finding.severity })),
    ...checkPostAsides(blocks),
    ...checkDashPivots(blocks),
  ];
  return { findings: applySeverity(settings, findings) };
}
