import { readFileSync } from "node:fs";

import type { MarketingConfig } from "../config/config.js";
import type { Film } from "../film.js";
import { getVoiceoverPaths as getCachePaths, readCachedVoiceover, type Voiceover, type VoiceoverPaths } from "../voice/cache.js";
import { describeVoiceoverBatch, produceVoiceovers as produceBatch } from "../voice/batch.js";
import { produceVoiceover as produce, type ProduceVoiceoverOptions } from "../voice/produce.js";
import type { TtsInput } from "../voice/provider.js";
import { createTtsProvider } from "../voice/providers.js";
import { voiceoverText } from "../voice/voiceover.js";
import { fail } from "./failure.js";

export type { Voiceover } from "../voice/cache.js";

function getTtsInput(film: Film): TtsInput {
  return { text: voiceoverText(film.beats), voiceId: film.voice.voiceId, model: film.voice.modelId, language: film.voice.language };
}

export function getVoiceoverPaths(config: MarketingConfig, film: Film): VoiceoverPaths {
  return getCachePaths(config.voice.cacheDir, getTtsInput(film), film.id);
}

/** JSON from disk with the file name in the error, not a bare "Unexpected token". */
export function readJson(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as unknown;
  } catch (error) {
    fail(`cannot read ${path}: ${String(error)}.`);
  }
}

export function requireVoiceover(config: MarketingConfig, film: Film): Voiceover {
  const cached = readCachedVoiceover(getVoiceoverPaths(config, film));
  if (!cached.ok) fail(cached.error);
  if (cached.value === null) fail(`no voiceover for "${film.id}": run softure-marketing voice ${film.id} --commit first.`);
  return cached.value;
}

function getProduceOptions(config: MarketingConfig, film: Film, isCommit: boolean): ProduceVoiceoverOptions {
  return {
    cacheDir: config.voice.cacheDir,
    input: getTtsInput(film),
    videoId: film.id,
    provider: createTtsProvider(config.voice.provider, { env: process.env }),
    isCommit,
    pace: { minIntervalSeconds: config.voice.minIntervalSeconds },
    log: (line) => console.log(line),
  };
}

/**
 * The voiceover from the cache, or a paid recording from the configured provider with `--commit`.
 * Without `--commit` it prints the cost estimate, spends nothing and returns null.
 */
export async function produceVoiceover(config: MarketingConfig, film: Film, isCommit: boolean): Promise<Voiceover | null> {
  const result = await produce(getProduceOptions(config, film, isCommit));
  if (!result.ok) fail(result.error);
  return result.value.kind === "dry-run" ? null : result.value.voiceover;
}

/**
 * `voice <film>...`: the films' voiceovers in order, paid calls spaced by `voice.minIntervalSeconds`. The first
 * failure stops the batch; the summary names what was recorded, where it stopped and what was never sent.
 */
export async function produceVoiceovers(config: MarketingConfig, films: Film[], isCommit: boolean): Promise<void> {
  const result = await produceBatch(films.map((film) => ({ id: film.id, options: getProduceOptions(config, film, isCommit) })));
  if (films.length > 1) console.log(["", ...describeVoiceoverBatch(result)].join("\n"));
  if (result.failed === null) return;
  if (films.length > 1) fail(`the batch stopped at ${result.failed.id}; ${result.notAttempted.length} ${result.notAttempted.length === 1 ? "film was" : "films were"} not sent. See above.`);
  fail(result.failed.error);
}
