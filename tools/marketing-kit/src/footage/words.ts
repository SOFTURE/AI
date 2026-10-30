/** Words compared as an editor hears them: without case, punctuation and repeated letters. */

/** A word reduced for comparison: lower case, letters and digits only, repeated letters collapsed (`Yyyy,` → `y`). */
export function normalizeWord(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "")
    .replace(/(.)\1+/gu, "$1");
}

/** Whether the word is one of the fillers (compared as `normalizeWord` writes both). */
export function isFiller(text: string, fillers: readonly string[]): boolean {
  const word = normalizeWord(text);
  return word.length > 0 && fillers.some((filler) => normalizeWord(filler) === word);
}
