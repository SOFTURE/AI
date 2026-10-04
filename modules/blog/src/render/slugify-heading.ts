// Heading text → anchor id: lower-case ASCII letters, digits and hyphens.

/** Letters that Unicode does not decompose into a base letter plus a mark. */
const FOLDED_LETTERS: Readonly<Record<string, string>> = {
  "\u0142": "l", // l with stroke
  "\u0111": "d", // d with stroke
  "\u00f8": "o", // o with stroke
  "\u00e6": "ae",
  "\u0153": "oe",
  "\u00df": "ss",
  "\u00fe": "th",
};

export function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\u0142\u0111\u00f8\u00e6\u0153\u00df\u00fe]/g, (letter) => FOLDED_LETTERS[letter] ?? letter)
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
