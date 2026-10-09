// `softure-blog refresh` (issue #318): the published texts whose numbers wait for a check. A text is
// stale when `current_as_of` is older than `limits.staleAfterDays` (the `stale` rule), and due when it
// quotes a fact rule whose value changed (its year or quarter began) after its `current_as_of`.
import { calendarDaysBetween } from "@softure-ai/core";
import type { ArticleFile } from "../db/publish-run.js";
import { parseArticleFile, type ParseArticleFileOptions } from "../content/article-file.js";
import { getProseBlocks, splitArticleBody, splitBlocks } from "./blocks.js";
import { getFactChangeDay, isFactSentence } from "./facts.js";
import type { QualitySettings } from "./settings.js";
import { splitSentences, toProse } from "./text.js";

export type RefreshReason =
  | { readonly kind: "stale"; readonly days: number }
  | { readonly kind: "fact"; readonly rule: string; readonly changedOn: string };

export interface TextToRefresh {
  readonly file: string;
  readonly slug: string;
  readonly currentAsOf: string;
  readonly reasons: readonly RefreshReason[];
}

/**
 * The published texts among `files` that need a refresh on `today` (`YYYY-MM-DD`), in the files' order.
 * A file that does not parse is left out: `softure-blog check` reports it.
 */
export function findTextsToRefresh(files: readonly ArticleFile[], settings: QualitySettings, today: string, parse?: ParseArticleFileOptions): TextToRefresh[] {
  return files.flatMap((file) => {
    const parsed = parseArticleFile(file.text, file.name, parse);
    if (!parsed.ok || parsed.article.status !== "published") return [];
    const { article } = parsed;
    const reasons: RefreshReason[] = [];
    const days = calendarDaysBetween(article.currentAsOf, today);
    if (days > settings.options.limits.staleAfterDays) reasons.push({ kind: "stale", days });
    const due = settings.options.facts.flatMap((rule) => {
      const changedOn = getFactChangeDay(today, rule.expires);
      return changedOn !== null && changedOn > article.currentAsOf ? [{ rule, changedOn }] : [];
    });
    if (due.length > 0) {
      const sentences = getSentences(file.text, article.bodyMarkdown);
      for (const { rule, changedOn } of due) {
        if (sentences.some((sentence) => isFactSentence(sentence, rule))) reasons.push({ kind: "fact", rule: rule.id, changedOn });
      }
    }
    return reasons.length === 0 ? [] : [{ file: file.name, slug: article.slug, currentAsOf: article.currentAsOf, reasons }];
  });
}

function getSentences(text: string, bodyMarkdown: string): string[] {
  const body = splitArticleBody(text)?.body ?? bodyMarkdown;
  return getProseBlocks(splitBlocks(body))
    .filter((block) => block.kind !== "heading")
    .flatMap((block) => splitSentences(toProse(block.text)));
}

/** One line of the report: why the text needs a refresh. */
export function describeRefreshReason(reason: RefreshReason, text: Pick<TextToRefresh, "currentAsOf">, staleAfterDays: number): string {
  return reason.kind === "stale"
    ? `current_as_of ${text.currentAsOf} is older than ${String(staleAfterDays)} days (${String(reason.days)})`
    : `${reason.rule} changed on ${reason.changedOn}, after current_as_of ${text.currentAsOf}`;
}
