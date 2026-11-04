import type { FootageFilm } from "./film.js";

/**
 * Key terms (Scribe keyterm prompting): names and brand words the transcript should spell as given. Scribe v2 batch
 * limits, checked 2026-11-03 (elevenlabs.io keyterm prompting guide): up to 1000 terms of at most 50 characters and
 * 5 words each. Keyterm prompting is billed on top of the transcription.
 */
export const SCRIBE_KEYTERM_LIMITS = { maxTerms: 1000, maxCharacters: 50, maxWords: 5 } as const;

export type KeyTermsResult = { ok: true; terms: string[] } | { ok: false; errors: string[] };

const compareCodePoints = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Key terms trimmed (inner whitespace collapsed to one space), without blanks and exact duplicates, sorted by code
 * point (the same order on every host, so the transcript's cache key is stable), or every limit a term breaks.
 */
export function normalizeKeyTerms(terms: readonly string[]): KeyTermsResult {
  const unique = new Set<string>();
  for (const term of terms) {
    const cleaned = term.trim().replace(/\s+/g, " ");
    if (cleaned.length > 0) unique.add(cleaned);
  }
  const { maxTerms, maxCharacters, maxWords } = SCRIBE_KEYTERM_LIMITS;
  const errors: string[] = [];
  if (unique.size > maxTerms) errors.push(`key terms: ${unique.size} terms, at most ${maxTerms}.`);
  for (const term of unique) {
    if (term.length > maxCharacters) errors.push(`key term "${term}": ${term.length} characters, at most ${maxCharacters}.`);
    const words = term.split(" ").length;
    if (words > maxWords) errors.push(`key term "${term}": ${words} words, at most ${maxWords}.`);
  }
  return errors.length > 0 ? { ok: false, errors } : { ok: true, terms: [...unique].sort(compareCodePoints) };
}

/** The film's key terms, normalized; none when the film has none. */
export function getFilmKeyTerms(film: Pick<FootageFilm, "keyTerms">): KeyTermsResult {
  return normalizeKeyTerms(film.keyTerms ?? []);
}
