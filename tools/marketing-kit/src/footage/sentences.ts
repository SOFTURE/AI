import type { TimedWord } from "../voice/voiceover.js";
import { normalizeWord } from "./words.js";

/**
 * The transcript as sentences with stable ids (`s1`, `s2`… in film order), and suggestions of the sentences an editor
 * usually drops: a retake (the same sentence said again later), a false start (a sentence begun and begun again) and a
 * cut-off sentence. The kit only suggests, with a reason; the caller decides what `buildEdl` keeps.
 */

export interface Sentence {
  /** `s<n>`, numbered across the film's talking clips in order. */
  id: string;
  /** The clip it is spoken in. */
  clip: string;
  /** Seconds in the trimmed clip. */
  start: number;
  end: number;
  text: string;
  words: TimedWord[];
  /** It ends with `.`, `?`, `!` or `…`. */
  isComplete: boolean;
}

export type RetakeKind = "retake" | "false-start" | "cut-off";

export interface RetakeSuggestion {
  /** The sentence to drop. */
  sentence: string;
  kind: RetakeKind;
  /** The sentence that replaces it (the later, good take); absent for a cut-off sentence. */
  of?: string;
  reason: string;
}

/** A silence this long ends a sentence even without punctuation. */
const SENTENCE_PAUSE_SECONDS = 1;
/** How many later sentences a take is compared with. */
const RETAKE_WINDOW = 3;
/** The share of the longer sentence's words, in order, that makes two sentences one sentence said twice. */
const RETAKE_SIMILARITY = 0.6;

const ENDS_SENTENCE = /[.?!…]["'”’)\]]*$/u;
const ENDS_CUT_OFF = /(-|—|–|\.\.\.|…)["'”’)\]]*$/u;

/** One clip's words as sentences; `firstNumber` is the number of the first id. */
export function splitSentences(words: TimedWord[], clip: string, firstNumber = 1): Sentence[] {
  const sorted = [...words].sort((a, b) => a.start - b.start);
  const groups: TimedWord[][] = [];
  let current: TimedWord[] = [];
  sorted.forEach((word, index) => {
    const previous = sorted[index - 1];
    if (current.length > 0 && previous !== undefined && word.start - previous.end > SENTENCE_PAUSE_SECONDS) {
      groups.push(current);
      current = [];
    }
    current.push(word);
    if (ENDS_SENTENCE.test(word.text.trim())) {
      groups.push(current);
      current = [];
    }
  });
  if (current.length > 0) groups.push(current);
  return groups.map((group, index) => {
    const last = group[group.length - 1] as TimedWord;
    return {
      id: `s${firstNumber + index}`,
      clip,
      start: (group[0] as TimedWord).start,
      end: last.end,
      text: group.map((word) => word.text.trim()).join(" "),
      words: group,
      isComplete: ENDS_SENTENCE.test(last.text.trim()) && !ENDS_CUT_OFF.test(last.text.trim()),
    };
  });
}

/** The sentences of every talking clip, numbered across the film in clip order. */
export function splitFilmSentences(clips: { id: string; role: string; words: TimedWord[] }[]): Sentence[] {
  const sentences: Sentence[] = [];
  for (const clip of clips) {
    if (clip.role !== "talk") continue;
    sentences.push(...splitSentences(clip.words, clip.id, sentences.length + 1));
  }
  return sentences;
}

function getTokens(sentence: Sentence): string[] {
  return sentence.words.map((word) => normalizeWord(word.text)).filter((token) => token.length > 0);
}

/** The length of the longest common subsequence of two token lists. */
function getCommonLength(a: string[], b: string[]): number {
  let previous = new Array<number>(b.length + 1).fill(0);
  for (const token of a) {
    const row = [0];
    b.forEach((other, j) => row.push(token === other ? (previous[j] ?? 0) + 1 : Math.max(previous[j + 1] ?? 0, row[j] ?? 0)));
    previous = row;
  }
  return previous[b.length] ?? 0;
}

function isPrefix(short: string[], long: string[]): boolean {
  return short.length > 0 && short.length < long.length && short.every((token, index) => long[index] === token);
}

/**
 * Sentences an editor would likely drop, each with the reason. Within one clip, a sentence is compared with the next
 * three: a `false-start` when its words begin a later sentence, a `retake` when 60 % or more of the longer one's words
 * match in order (the later take is kept). Otherwise a sentence that ends in a dash or an ellipsis, or ends its clip
 * without a full stop, is `cut-off`.
 */
export function findRetakes(sentences: Sentence[]): RetakeSuggestion[] {
  const suggestions: RetakeSuggestion[] = [];
  sentences.forEach((sentence, index) => {
    const tokens = getTokens(sentence);
    const later = sentences.slice(index + 1, index + 1 + RETAKE_WINDOW).filter((other) => other.clip === sentence.clip);
    for (const other of later) {
      const otherTokens = getTokens(other);
      if (isPrefix(tokens, otherTokens)) {
        suggestions.push({ sentence: sentence.id, kind: "false-start", of: other.id, reason: `${other.id} starts with the same words and finishes the sentence` });
        return;
      }
      const longest = Math.max(tokens.length, otherTokens.length);
      const similarity = longest === 0 ? 0 : getCommonLength(tokens, otherTokens) / longest;
      if (tokens.length > 0 && similarity >= RETAKE_SIMILARITY) {
        suggestions.push({ sentence: sentence.id, kind: "retake", of: other.id, reason: `${other.id} says it again (${Math.round(similarity * 100)} % of the words); the later take is kept` });
        return;
      }
    }
    const last = sentence.words.at(-1)?.text.trim() ?? "";
    const next = sentences[index + 1];
    const isLastOfClip = next === undefined || next.clip !== sentence.clip;
    if (ENDS_CUT_OFF.test(last)) suggestions.push({ sentence: sentence.id, kind: "cut-off", reason: "it breaks off mid-sentence" });
    else if (!sentence.isComplete && isLastOfClip) suggestions.push({ sentence: sentence.id, kind: "cut-off", reason: "the clip ends before the sentence does" });
  });
  return suggestions;
}
