import { createHash } from "node:crypto";
import { createReadStream, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import type { TimedWord } from "../voice/voiceover.js";

/**
 * The paid footage cache: what a provider returned, stored under a key made of the input's bytes and every setting
 * that changes the answer, so a re-render never pays twice and a changed clip is never served a stale result. Files
 * live in `<cacheDir>/<film id>/` (the project commits them, as it commits the voiceover).
 */

export type FootageCacheKind = "transcript" | "isolated" | "music";

const SUFFIXES: Record<FootageCacheKind, string> = { transcript: "transcript.json", isolated: "isolated.mp3", music: "music.mp3" };

/** SHA-256 of a file's bytes, streamed (phone clips are large). */
export async function hashFile(path: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk as Buffer);
  return hash.digest("hex");
}

/** A cache key: the first 16 hex digits of the SHA-256 of the parts as JSON. */
export function footageCacheKey(kind: FootageCacheKind, parts: Record<string, unknown>): string {
  return createHash("sha256")
    .update(JSON.stringify({ kind, ...parts }))
    .digest("hex")
    .slice(0, 16);
}

export function getFootageCachePath(cacheDir: string, filmId: string, kind: FootageCacheKind, key: string): string {
  return join(cacheDir, filmId, `${key}.${SUFFIXES[kind]}`);
}

export function writeCacheFile(path: string, data: Buffer | string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, data);
}

function isTimedWords(value: unknown): value is TimedWord[] {
  return (
    Array.isArray(value) &&
    value.every((item: unknown) => {
      if (typeof item !== "object" || item === null) return false;
      const word = item as Record<string, unknown>;
      return typeof word.text === "string" && typeof word.start === "number" && typeof word.end === "number";
    })
  );
}

/** A cached transcript; null when there is none, an error naming a broken file. */
export function readCachedTranscript(path: string): { ok: true; words: TimedWord[] | null } | { ok: false; error: string } {
  if (!existsSync(path)) return { ok: true, words: null };
  let words: unknown;
  try {
    words = JSON.parse(readFileSync(path, "utf8")) as unknown;
  } catch (error) {
    return { ok: false, error: `cannot read ${path}: ${String(error)}` };
  }
  return isTimedWords(words) ? { ok: true, words } : { ok: false, error: `${path} is not a list of timed words` };
}

export function writeTranscript(path: string, words: TimedWord[]): void {
  writeCacheFile(path, `${JSON.stringify(words, null, 1)}\n`);
}
