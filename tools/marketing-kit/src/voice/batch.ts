import { produceVoiceover, type ProduceVoiceoverOptions, type VoiceoverOutcome } from "./produce.js";

/**
 * Voiceovers of several films in one run, in order. The first failure stops the batch: nothing after it reaches the
 * provider, so a refusal (a bad key, an exhausted balance, a policy block) is never answered with more calls.
 */

export interface VoiceoverBatchItem {
  /** The film the voiceover belongs to, for the summary. */
  id: string;
  options: ProduceVoiceoverOptions;
}

export interface VoiceoverBatchResult {
  /** Films that finished, in order, with what happened to each. */
  done: { id: string; outcome: VoiceoverOutcome }[];
  /** The film that failed, or null when every film finished. */
  failed: { id: string; error: string } | null;
  /** Films after the failure, never sent. */
  notAttempted: string[];
}

export async function produceVoiceovers(items: VoiceoverBatchItem[]): Promise<VoiceoverBatchResult> {
  const done: VoiceoverBatchResult["done"] = [];
  for (const [index, item] of items.entries()) {
    const result = await produceVoiceover(item.options);
    if (!result.ok) {
      return { done, failed: { id: item.id, error: result.error }, notAttempted: items.slice(index + 1).map((rest) => rest.id) };
    }
    done.push({ id: item.id, outcome: result.value });
  }
  return { done, failed: null, notAttempted: [] };
}

/** The batch in a few lines: what was recorded, from the cache or only estimated, the totals, and where it stopped. */
export function describeVoiceoverBatch(result: VoiceoverBatchResult): string[] {
  const byKind = (kind: VoiceoverOutcome["kind"]) => result.done.filter((entry) => entry.outcome.kind === kind).map((entry) => entry.id);
  const lines: string[] = [];
  for (const [label, ids] of [
    ["recorded", byKind("recorded")],
    ["from the cache", byKind("cached")],
    ["estimated only (dry run)", byKind("dry-run")],
  ] as const) {
    if (ids.length > 0) lines.push(`voiceovers ${label}: ${ids.length} (${ids.join(", ")})`);
  }
  const priced = result.done.flatMap((entry) => (entry.outcome.kind === "cached" ? [] : [entry.outcome]));
  const [first] = priced;
  if (first !== undefined) {
    const characters = priced.reduce((sum, outcome) => sum + outcome.estimate.characters, 0);
    const maxCost = priced.reduce((sum, outcome) => sum + outcome.estimate.maxCost, 0);
    lines.push(`total: ${characters} characters, at most ${maxCost} ${first.estimate.unit}.`);
    const recorded = priced.flatMap((outcome) => (outcome.kind === "recorded" ? [outcome] : []));
    const charges = recorded.flatMap((outcome) => (outcome.charged === null ? [] : [outcome.charged]));
    if (recorded.length > 0) {
      const unreported = recorded.length - charges.length;
      const total = Math.round(charges.reduce((sum, charge) => sum + charge, 0) * 1000) / 1000;
      lines.push(`charged: ${total} ${first.estimate.unit}${unreported > 0 ? ` (${unreported} ${unreported === 1 ? "recording" : "recordings"} did not report a charge)` : ""}.`);
    }
  }
  if (result.failed !== null) {
    lines.push(`stopped at ${result.failed.id}: ${result.failed.error}`);
    if (result.notAttempted.length > 0) lines.push(`not attempted: ${result.notAttempted.join(", ")}.`);
  }
  return lines;
}
