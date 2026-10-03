import type { Locator, Page } from "playwright";

/**
 * Film = script (data) + scene (code), one module per film in the project's films folder.
 *
 * The scene is code, not JSON, because it is made of Playwright locators, the order of actions and
 * waiting for a word of the voiceover; types catch a typo in a beat name that JSON would not.
 */

export const PLATFORMS = ["instagram", "facebook", "tiktok"] as const;

export type Platform = (typeof PLATFORMS)[number];

/** One sentence of the voiceover and the screen time that goes with it. */
export interface Beat {
  id: string;
  text: string;
}

export interface Persona {
  name: string;
  age: number;
  /** Second line of the persona card, e.g. "works out when they can stop working". */
  tagline: string;
}

export interface VoiceSettings {
  voiceId: string;
  modelId: string;
  /**
   * Voiceover speed-up applied at build time (`ffmpeg atempo`), not in the API, so the paid
   * voiceover cache stays valid when the tempo changes.
   */
  tempo: number;
}

export interface EndCard {
  headline: string;
  url: string;
  note: string;
}

export interface PostCopy {
  /** Text shared by the three platforms; `posts.ts` adds the link and the hashtags. */
  caption: string;
  hashtags: string[];
}

/**
 * The film's opening: a frame of the recording (the `still` mark) and camera shots on marks,
 * first close up, then wider.
 */
export interface HookShot {
  mark: string;
  scale: number;
  /** Word of the opening sentence on which the camera moves to this shot (the first one: at once). */
  word?: string;
}

export interface Film {
  id: string;
  title: string;
  persona: Persona;
  voice: VoiceSettings;
  /**
   * Voiceover sentences in order. The **first** plays over the opening (the result frame); the
   * scene records the rest, and the **last** ends with the end card.
   */
  beats: Beat[];
  hook: { still: string; shots: HookShot[] };
  /**
   * Phrases the voiceover says that the app's screen must show. If any is missing the recording
   * stops and the render never starts.
   */
  screenGuard: string[];
  channels: Record<Platform, string>;
  endCard: EndCard;
  post: PostCopy;
  scene: (director: Director) => Promise<void>;
}

/** The scene's access to the page and to the actions recorded frame by frame. */
export interface Director {
  readonly page: Page;
  /** A beat: the actions, then a hold until the voiceover finishes the sentence. */
  beat(id: string, actions: () => Promise<void>, options?: { pad?: number }): Promise<void>;
  /** Wait until the voiceover says the word (counted from the start of the current beat). */
  until(word: string): Promise<void>;
  hold(seconds: number): Promise<void>;
  /** Scroll so the element's top edge stands `top` px from the top of the screen. */
  bring(target: Locator, options?: { top?: number; seconds?: number }): Promise<void>;
  tap(target: Locator, options?: { after?: number }): Promise<void>;
  type(text: string, options?: { perChar?: number }): Promise<void>;
  /** Tap the `input[name=…]` field, move the camera onto it and type the value. */
  fill(name: string, value: string): Promise<void>;
  blur(): Promise<void>;
  /** Camera on an element (or on the rectangle that encloses several). */
  focus(target: Locator | Locator[], options?: { scale?: number; height?: number }): Promise<void>;
  /** Camera on the whole phone screen. */
  wide(options?: { scale?: number; whoosh?: boolean }): Promise<void>;
  /** Remember an element's rectangle under a name (e.g. for an opening shot). */
  mark(name: string, target: Locator | Locator[]): Promise<void>;
  /** Remember the current frame as the opening frame. */
  still(name: string): Promise<void>;
  /** An event on the film's timeline: a sound effect or the persona card leaving. */
  cue(name: CueName): Promise<void>;
  /** The screen guard: check now, before the recording goes on. */
  checkScreen(): Promise<void>;
}

export const CUES = ["sparkle", "persona-out"] as const;

export type CueName = (typeof CUES)[number];

/** Longest channel code; long enough for `fb-some-group`, too short for a URL or a sentence. */
const CHANNEL_CODE_MAX_LENGTH = 20;
const CHANNEL_CODE_SHAPE = /^[a-z0-9-]+$/;

/**
 * Whether a channel code survives the app's channel tag reader unchanged (FIRE's `readChannelTag`
 * rule: lowercase letters, digits and hyphens, at most 20 characters). Any other code would make
 * visits from the film uncountable.
 */
export function isChannelCode(code: string): boolean {
  return code.length > 0 && code.length <= CHANNEL_CODE_MAX_LENGTH && CHANNEL_CODE_SHAPE.test(code);
}

export function validateFilm(film: Film): void {
  const problems: string[] = [];
  const ids = film.beats.map((beat) => beat.id);
  if (film.beats.length < 3) {
    problems.push("a film needs at least three sentences: opening, scene, end card");
  }
  const duplicate = ids.find((id, index) => ids.indexOf(id) !== index);
  if (duplicate !== undefined) problems.push(`sentence "${duplicate}" appears twice`);
  if (film.beats.some((beat) => beat.text.trim().length === 0)) {
    problems.push("empty voiceover sentence");
  }
  if (film.screenGuard.length === 0 || film.screenGuard.some((phrase) => phrase.trim() === "")) {
    problems.push("the screen guard needs non-empty phrases");
  }
  if (!(film.voice.tempo >= 0.8 && film.voice.tempo <= 1.3)) {
    problems.push(`voiceover tempo ${film.voice.tempo} outside 0.8-1.3`);
  }
  for (const platform of PLATFORMS) {
    const code = film.channels[platform];
    if (!isChannelCode(code)) {
      problems.push(`channel code for ${platform} "${code}" is not lowercase letters, digits and hyphens (at most ${CHANNEL_CODE_MAX_LENGTH})`);
    }
  }
  if (film.hook.shots.length === 0) problems.push("the opening needs at least one shot");
  const badId = ids.find((id) => !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id));
  if (badId !== undefined) problems.push(`sentence id "${badId}": lowercase letters, digits and hyphens only`);
  const hookWords = (film.beats[0]?.text ?? "").split(/\s+/).map((word) => word.replace(/[.,?!:;]/g, ""));
  for (const shot of film.hook.shots) {
    if (shot.word !== undefined && !hookWords.includes(shot.word)) {
      problems.push(`opening shot "${shot.mark}" waits for the word "${shot.word}", which is not in the first sentence`);
    }
  }

  if (problems.length > 0) {
    throw new Error(`Film ${film.id}: ${problems.join("; ")}.`);
  }
}

/** Sentences recorded by the scene: all but the opening. */
export function sceneBeats(film: Film): Beat[] {
  return film.beats.slice(1);
}

/**
 * The phrase as whole words: "49 years" must not pass thanks to "149 years". Whitespace
 * (non-breaking spaces in amounts too) compares as a single space.
 */
export function containsPhrase(text: string, phrase: string): boolean {
  const escaped = phrase
    .trim()
    .split(/\s+/)
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("\\s+");
  return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, "u").test(text);
}
