import { dirname, join } from "node:path";

import { findStaleVoiceovers, getVoiceoverPaths, readCachedVoiceover, writeVoiceover, type Voiceover } from "./cache.js";
import { err, ok, type TtsEstimate, type TtsInput, type TtsProvider, type TtsResult } from "./provider.js";

export interface ProduceVoiceoverOptions {
  cacheDir: string;
  input: TtsInput;
  /** The film the voiceover belongs to: its recordings live in `<cacheDir>/<videoId>/`. Without it, the flat layout. */
  videoId?: string;
  provider: TtsProvider;
  /** Only `true` lets the provider spend money. */
  isCommit: boolean;
  log: (line: string) => void;
}

export type VoiceoverOutcome =
  | { kind: "cached"; key: string; voiceover: Voiceover }
  | { kind: "dry-run"; key: string; estimate: TtsEstimate }
  | { kind: "recorded"; key: string; voiceover: Voiceover; estimate: TtsEstimate };

export function describeEstimate(provider: TtsProvider, estimate: TtsEstimate): string {
  return `voiceover estimate (${provider.id}): ${estimate.characters} characters, at most ${estimate.maxCost} ${estimate.unit}.`;
}

/**
 * The voiceover from the cache, or a recording from the provider. The estimate is logged in every dry
 * run and before every paid call; without `isCommit` the provider is never called.
 */
export async function produceVoiceover(options: ProduceVoiceoverOptions): Promise<TtsResult<VoiceoverOutcome>> {
  const { cacheDir, input, videoId, provider, isCommit, log } = options;
  const paths = getVoiceoverPaths(cacheDir, input, videoId);
  const cached = readCachedVoiceover(paths);
  if (!cached.ok) return cached;
  if (videoId !== undefined) {
    const stale = findStaleVoiceovers(cacheDir, videoId, paths.key);
    if (stale.length > 0) {
      log(`voiceover: ${join(cacheDir, videoId)} also holds ${stale.join(", ")}, which the current script does not use; delete them once no film needs them.`);
    }
  }
  if (cached.value !== null) {
    log(`voiceover: from the cache ${paths.key}, nothing spent.`);
    if (videoId !== undefined && paths.layout === "flat") {
      log(`voiceover: ${paths.key}.mp3 and .json sit in the cache root (the layout before 0.1.6); move them into ${join(cacheDir, videoId)}/ to keep them with their film.`);
    }
    return ok({ kind: "cached", key: paths.key, voiceover: cached.value });
  }
  const estimate = provider.estimate(input);
  log(describeEstimate(provider, estimate));
  if (!isCommit) {
    log(`voiceover DRY RUN (voice ${input.voiceId}): nothing was sent. Run with --commit to pay and record.`);
    return ok({ kind: "dry-run", key: paths.key, estimate });
  }
  const recording = await provider.synthesize(input);
  if (!recording.ok) return err(recording.error);
  const voiceover = writeVoiceover(cacheDir, paths, recording.value);
  log(`voiceover: recorded ${estimate.characters} characters, saved ${paths.key}.{mp3,json} in ${dirname(paths.audio)} (commit them).`);
  return ok({ kind: "recorded", key: paths.key, voiceover, estimate });
}
