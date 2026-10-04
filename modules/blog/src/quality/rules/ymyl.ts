// YMYL rules (FIRE_TRACKER `rules-structure.ts`, sources and `checkNumberSources`): an article lists
// its sources over https, and every significant number carries a footnote whose address is a listed
// source, or which names the app's own calculation (`ymyl.ownCalculationMark`).
import type { Block } from "../blocks.js";
import type { QualityFinding } from "../finding.js";
import { findBareUrls, findFootnoteRefs, findSignificantNumbers, toProse } from "../text.js";
import type { RuleInput } from "./input.js";
import { getFootnoteDefinitions } from "./structure.js";

export function checkSources({ article }: RuleInput): QualityFinding[] {
  const findings: QualityFinding[] = [];
  if (article.kind === "article" && article.sources.length === 0) {
    findings.push({ rule: "sources-missing", severity: "error", message: "the article lists no sources (name and address of each)" });
  }
  for (const source of article.sources) {
    if (!source.url.startsWith("https://")) {
      findings.push({ rule: "source-https", severity: "error", message: `source "${source.name}" has an address without https: ${source.url}` });
    }
  }
  return findings;
}

export function checkNumberSources({ article, blocks, settings }: RuleInput): QualityFinding[] {
  const findings: QualityFinding[] = [];
  const { notation } = settings.ruleset;
  const mark = settings.options.ymyl?.ownCalculationMark ?? null;
  for (const block of blocks) {
    if (block.kind === "footnote" || block.kind === "directive" || block.kind === "heading") continue;
    const numbers = findSignificantNumbers(toProse(block.text), notation);
    if (numbers.length > 0 && findFootnoteRefs(block.text).length === 0 && !isTableSourcedNearby(blocks, block)) {
      const remedy = mark === null ? "add a footnote with the source's address" : `add a footnote with the source's address or "${mark}"`;
      findings.push({ rule: "number-source", severity: "error", message: `a number without a source: ${numbers.slice(0, 3).join(", ")}; ${remedy}`, line: block.line });
    }
  }
  const sourceUrls = new Set(article.sources.map((source) => source.url));
  for (const [id, block] of getFootnoteDefinitions(blocks)) {
    const urls = findBareUrls(block.text);
    const isOwnCalculation = mark !== null && block.text.toLowerCase().includes(mark.toLowerCase());
    if (urls.length === 0 && !isOwnCalculation) {
      const message = mark === null ? `footnote [^${id}] has no source address` : `footnote [^${id}] has neither a source address nor "${mark}"`;
      findings.push({ rule: "footnote-source", severity: "error", message, line: block.line });
    }
    for (const url of urls) {
      if (!sourceUrls.has(url)) {
        findings.push({ rule: "footnote-not-in-sources", severity: "error", message: `the address in footnote [^${id}] is not in sources: ${url}`, line: block.line });
      }
    }
  }
  return findings;
}

/** A table has no room for a footnote per cell, so the paragraph right above or below may carry it. */
function isTableSourcedNearby(blocks: readonly Block[], table: Block): boolean {
  if (table.kind !== "table") return false;
  const index = blocks.indexOf(table);
  return [blocks[index - 1], blocks[index + 1]].some((neighbour) => neighbour?.kind === "paragraph" && findFootnoteRefs(neighbour.text).length > 0);
}
