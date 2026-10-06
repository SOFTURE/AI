import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Paid calls are spaced so a batch of films never reaches the provider as a burst (FIRE_TRACKER sent 26 in about ten
 * minutes from a shell loop and drew an ElevenLabs policy warning). The time of the last paid call is read from the
 * cache itself: every paid call writes `<key>.json` right after the response, so pacing also holds across separate
 * runs of the CLI and needs no state file.
 */

export interface PaceOptions {
  /** The voiceover cache: recordings at its root (the flat layout) and in one folder per video. */
  cacheDir: string;
  /** The least time between two paid calls; 0 turns pacing off. */
  minIntervalSeconds: number;
  /** Injected in tests; `Date.now` otherwise. */
  now?: () => number;
  /** Injected in tests; a timer otherwise. */
  sleep?: (milliseconds: number) => Promise<void>;
  log: (line: string) => void;
}

const sleepFor = (milliseconds: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, milliseconds));

function listWordFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isFile() && entry.name.endsWith(".json")) return [path];
    if (!entry.isDirectory()) return [];
    return readdirSync(path, { withFileTypes: true })
      .filter((inner) => inner.isFile() && inner.name.endsWith(".json"))
      .map((inner) => join(path, inner.name));
  });
}

/** When the newest recording in the cache was written, in epoch milliseconds; null for an empty or missing cache. */
export function findLastRecordingTime(cacheDir: string): number | null {
  if (!existsSync(cacheDir)) return null;
  const times = listWordFiles(cacheDir).map((path) => statSync(path).mtimeMs);
  return times.length === 0 ? null : Math.max(...times);
}

/** Waits until `minIntervalSeconds` have passed since the newest recording in the cache; returns the seconds waited. */
export async function waitForPace(options: PaceOptions): Promise<number> {
  const { cacheDir, minIntervalSeconds, log } = options;
  if (minIntervalSeconds <= 0) return 0;
  const last = findLastRecordingTime(cacheDir);
  if (last === null) return 0;
  const now = (options.now ?? Date.now)();
  const remaining = Math.ceil((last + minIntervalSeconds * 1000 - now) / 1000);
  if (remaining <= 0) return 0;
  log(`voiceover: the last paid recording in ${cacheDir} is under ${minIntervalSeconds} s old (voice.minIntervalSeconds); waiting ${remaining} s before the next call.`);
  await (options.sleep ?? sleepFor)(remaining * 1000);
  return remaining;
}
