import { readFileSync } from "node:fs";

import type { MarketingConfig } from "../config/config.js";
import type { Film } from "../film.js";
import { getVoiceoverPaths as getCachePaths, readCachedVoiceover, type Voiceover, type VoiceoverPaths } from "../voice/cache.js";
import { produceVoiceover as produce } from "../voice/produce.js";
import type { TtsInput } from "../voice/provider.js";
import { createTtsProvider } from "../voice/providers.js";
import { voiceoverText } from "../voice/voiceover.js";
import { fail } from "./failure.js";

export type { Voiceover } from "../voice/cache.js";

function getTtsInput(film: Film): TtsInput {
  return { text: voiceoverText(film.beats), voiceId: film.voice.voiceId, model: film.voice.modelId, language: film.voice.language };
}

export function getVoiceoverPaths(config: MarketingConfig, film: Film): VoiceoverPaths {
  return getCachePaths(config.voice.cacheDir, getTtsInput(film));
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

/**
 * The voiceover from the cache, or a paid recording from the configured provider with `--commit`.
 * Without `--commit` it prints the cost estimate, spends nothing and returns null.
 */
export async function produceVoiceover(config: MarketingConfig, film: Film, isCommit: boolean): Promise<Voiceover | null> {
  const result = await produce({
    cacheDir: config.voice.cacheDir,
    input: getTtsInput(film),
    provider: createTtsProvider(config.voice.provider, { env: process.env }),
    isCommit,
    log: (line) => console.log(line),
  });
  if (!result.ok) fail(result.error);
  return result.value.kind === "dry-run" ? null : result.value.voiceover;
}
