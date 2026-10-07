import { containsPhrase, type Beat } from "../film.js";

/**
 * The screen guard's rules, apart from the browser: which phrases a check covers and what a failure says. The
 * video's `screenGuard` is checked at every `checkScreen`; a sentence's own `screenGuard` at a `checkScreen` inside
 * that sentence, or, without one, when the sentence ends, so each number is proven on screen while it is spoken.
 */

/** The phrases a `checkScreen` covers: the video's, plus the current sentence's own (none before the first sentence). */
export function getCheckScreenPhrases(videoPhrases: readonly string[], sentence: Beat | null): string[] {
  return [...videoPhrases, ...(sentence?.screenGuard ?? [])];
}

/** The phrases the screen's text does not contain as whole words, in their order. */
export function findMissingPhrases(text: string, phrases: readonly string[]): string[] {
  return phrases.filter((phrase) => !containsPhrase(text, phrase));
}

const quote = (phrases: readonly string[]): string => phrases.map((phrase) => `"${phrase}"`).join(", ");

function describeFix(filmPath: string): string {
  return (
    `The app counts from the recording day: if the voiceover was paid for on another day, pin that day in the video's ` +
    `"today" (or pass --today=YYYY-MM-DD); otherwise fix the sentences and phrases in ${filmPath}.`
  );
}

export function describeCheckScreenFailure(missing: readonly string[], filmPath: string): string {
  return `The screen does not say what the voiceover says: missing ${quote(missing)}. ${describeFix(filmPath)}`;
}

export function describeSentenceFailure(sentenceId: string, missing: readonly string[], filmPath: string): string {
  return (
    `Sentence "${sentenceId}" ended without its screenGuard phrases on screen: missing ${quote(missing)}. ` +
    `Reveal them before the sentence ends, or check them where they show with a checkScreen inside the sentence. ${describeFix(filmPath)}`
  );
}
