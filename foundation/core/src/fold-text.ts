// Text folded for matching what a person typed against what was written: lower case, accents dropped, so "Zurich",
// "ZÜRICH" and "zürich" compare equal and a Polish or German query matches however the text was typed. Pure, and the
// same on every runtime, so it can also feed a stored search column (unlike Postgres `unaccent`, whose dictionary is
// not immutable).

// Letters that NFKD does not split into a base letter and a mark: l, o and d with stroke, sharp s, the ae and oe
// ligatures (lower case, since the text is lowered first).
// By code point, so the source stays plain ASCII.
const UNSPLIT_LETTERS: ReadonlyMap<string, string> = new Map(
  (
    [
      [0x142, "l"],
      [0xf8, "o"],
      [0x111, "d"],
      [0xdf, "ss"],
      [0xe6, "ae"],
      [0x153, "oe"],
    ] as const
  ).map(([codePoint, folded]) => [String.fromCodePoint(codePoint), folded]),
);

const UNSPLIT_PATTERN = new RegExp(`[${[...UNSPLIT_LETTERS.keys()].join("")}]`, "gu");

/**
 * The text in lower case without accents; every other character (spaces, punctuation) stays. "ß" becomes "ss" and the
 * ligatures two letters, so the result can be longer than the input.
 */
export function foldText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .replace(UNSPLIT_PATTERN, (letter) => UNSPLIT_LETTERS.get(letter) ?? letter);
}

/** The folded text's words (letters and digits) separated by single spaces; an empty string when it has none. */
export function foldWords(text: string): string {
  return foldText(text)
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}
