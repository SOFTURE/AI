import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { describeVoiceoverBatch, produceVoiceovers, type VoiceoverBatchItem } from "./batch.js";
import { createFakeTtsProvider } from "./fake.js";
import type { TtsInput, TtsProvider } from "./provider.js";

let root: string;
let lines: string[];
const log = (line: string) => lines.push(line);

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "voiceover-batch-"));
  lines = [];
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

const input = (text: string): TtsInput => ({ text, voiceId: "v", model: "m", language: "en" });

/** A metered provider charging 0.5 per character, failing for the texts in `refuse`. */
function meteredProvider(refuse: string[] = []): TtsProvider & { calls: string[] } {
  const fake = createFakeTtsProvider();
  const calls: string[] = [];
  return {
    id: "metered",
    calls,
    estimate: (value) => ({ characters: value.text.length, maxCost: value.text.length, unit: "credits" }),
    synthesize: async (value) => {
      calls.push(value.text);
      if (refuse.includes(value.text)) return { ok: false, error: "metered answered 401: unusual activity" };
      const recording = await fake.synthesize(value);
      return recording.ok ? { ok: true, value: { ...recording.value, charged: value.text.length / 2 } } : recording;
    },
  };
}

function items(provider: TtsProvider, isCommit: boolean, texts: Record<string, string>): VoiceoverBatchItem[] {
  return Object.entries(texts).map(([id, text]) => ({
    id,
    options: { cacheDir: join(root, "cache"), input: input(text), videoId: id, provider, isCommit, log },
  }));
}

describe("produceVoiceovers", () => {
  it("records every film in order and sums the estimate and the charge", async () => {
    const provider = meteredProvider();
    const result = await produceVoiceovers(items(provider, true, { ania: "One two.", ola: "Three four five." }));
    expect(provider.calls).toEqual(["One two.", "Three four five."]);
    expect(result.failed).toBeNull();
    expect(describeVoiceoverBatch(result)).toEqual([
      "voiceovers recorded: 2 (ania, ola)",
      "total: 24 characters, at most 24 credits.",
      "charged: 12 credits.",
    ]);
  });

  it("stops at the first failure and sends nothing after it", async () => {
    const provider = meteredProvider(["Two."]);
    const result = await produceVoiceovers(items(provider, true, { ania: "One.", bartek: "Two.", ola: "Three.", ewa: "Four." }));
    expect(provider.calls).toEqual(["One.", "Two."]);
    expect(result).toMatchObject({ failed: { id: "bartek", error: "metered answered 401: unusual activity" }, notAttempted: ["ola", "ewa"] });
    expect(describeVoiceoverBatch(result)).toEqual([
      "voiceovers recorded: 1 (ania)",
      "total: 4 characters, at most 4 credits.",
      "charged: 2 credits.",
      "stopped at bartek: metered answered 401: unusual activity",
      "not attempted: ola, ewa.",
    ]);
  });

  it("in a dry run calls no provider and prints the batch's total before anything is paid", async () => {
    const provider = meteredProvider();
    const result = await produceVoiceovers(items(provider, false, { ania: "One two.", ola: "Three four five." }));
    expect(provider.calls).toEqual([]);
    expect(describeVoiceoverBatch(result)).toEqual(["voiceovers estimated only (dry run): 2 (ania, ola)", "total: 24 characters, at most 24 credits."]);
  });

  it("leaves cached films out of the total and counts recordings without a reported charge", async () => {
    const metered = meteredProvider();
    await produceVoiceovers(items(metered, true, { ania: "One two." }));
    const silent = createFakeTtsProvider();
    const provider: TtsProvider = { ...silent, estimate: (value) => ({ characters: value.text.length, maxCost: value.text.length, unit: "credits" }) };
    const result = await produceVoiceovers(items(provider, true, { ania: "One two.", ola: "Three." }));
    expect(describeVoiceoverBatch(result)).toEqual([
      "voiceovers recorded: 1 (ola)",
      "voiceovers from the cache: 1 (ania)",
      "total: 6 characters, at most 6 credits.",
      "charged: 0 credits (1 recording did not report a charge).",
    ]);
  });

  it("is empty for no films", async () => {
    expect(describeVoiceoverBatch(await produceVoiceovers([]))).toEqual([]);
  });
});
