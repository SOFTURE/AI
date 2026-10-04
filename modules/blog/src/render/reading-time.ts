// Reading time of an article body.

/** Words per minute assumed for prose of an article. */
export const DEFAULT_WORDS_PER_MINUTE = 200;

/**
 * Minutes needed to read the text: words of prose (footnote definitions, URLs and Markdown syntax
 * removed), rounded up, at least 1.
 */
export function getReadingMinutes(markdown: string, wordsPerMinute: number = DEFAULT_WORDS_PER_MINUTE): number {
  const prose = markdown
    .replace(/^\[\^[^\]]+\]:.*$/gm, "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\[\^[^\]]+\]/g, "")
    .replace(/[#>*_|`[\]()-]/g, " ");
  const words = prose.split(/\s+/).filter((word) => /\p{L}|\d/u.test(word)).length;
  return Math.max(1, Math.ceil(words / wordsPerMinute));
}
