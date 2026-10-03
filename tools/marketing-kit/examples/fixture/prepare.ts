import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { voiceoverKey, voiceoverText, type TimedWord } from "../../src/voice/voiceover.js";
import { film } from "./films/fixture-tour.js";

/**
 * Copies the fixture project into `target` and generates what a real project would commit or
 * supply, so nothing binary lives in the repository and nothing is paid for:
 * - the voiceover cache entry under the film's key: a quiet tone and evenly spaced word timings;
 * - the five sound effects the composition plays, as short tones;
 * - an empty fonts folder (the composition falls back to the system's sans-serif).
 * Needs ffmpeg in PATH.
 */

const SECONDS_PER_WORD = 0.4;
const PAUSE_BETWEEN_SENTENCES = 0.5;
const SFX = { "click-soft": 1200, "key-press": 900, whoosh: 300, sparkle: 1800, pop: 600 } as const;

function makeTone(output: string, frequency: number, seconds: number, volume: number): void {
  execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", `sine=frequency=${frequency}:duration=${seconds}`, "-filter:a", `volume=${volume}`, "-c:a", "libmp3lame", "-q:a", "6", output]);
}

/** Word timings of the fixture voiceover, as ElevenLabs would return them for the whole text. */
export function makeFixtureWords(): TimedWord[] {
  const words: TimedWord[] = [];
  let time = 0.1;
  for (const beat of film.beats) {
    for (const text of beat.text.trim().split(/\s+/)) {
      words.push({ text, start: Math.round(time * 1000) / 1000, end: Math.round((time + SECONDS_PER_WORD - 0.05) * 1000) / 1000 });
      time += SECONDS_PER_WORD;
    }
    time += PAUSE_BETWEEN_SENTENCES;
  }
  return words;
}

export function prepareFixture(target: string): { config: string } {
  cpSync(import.meta.dirname, target, {
    recursive: true,
    filter: (source) => !/[/\\](build|out|voiceover|assets)$/.test(source),
  });
  const words = makeFixtureWords();
  const key = voiceoverKey(voiceoverText(film.beats), film.voice.voiceId, film.voice.modelId);
  const voiceoverDir = join(target, "voiceover");
  mkdirSync(voiceoverDir, { recursive: true });
  const lastWord = words.at(-1);
  makeTone(join(voiceoverDir, `${key}.mp3`), 220, (lastWord?.end ?? 0) + 0.5, 0.05);
  writeFileSync(join(voiceoverDir, `${key}.json`), `${JSON.stringify(words, null, 1)}\n`);
  const sfxDir = join(target, "assets", "sfx");
  mkdirSync(sfxDir, { recursive: true });
  for (const [name, frequency] of Object.entries(SFX)) makeTone(join(sfxDir, `${name}.mp3`), frequency, 0.3, 0.3);
  mkdirSync(join(target, "assets", "fonts"), { recursive: true });
  return { config: join(target, "marketing.config.json") };
}
