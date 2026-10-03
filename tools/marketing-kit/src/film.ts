import type { Locator, Page } from "playwright";

import type { VideoFormat, Viewport } from "./compose/timeline.js";

/**
 * Film = script (data from `marketing.json`) + scene: the beats' `actions` in the same file
 * (`src/record/actions.ts` plays them on the Director), or a project's TS module (`sceneModule`) when
 * the scene needs logic.
 */

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
  /** ISO 639 code the voice speaks; part of the voiceover cache key. */
  language: string;
  /**
   * Voiceover speed-up applied at build time (`ffmpeg atempo`), not in the API, so the paid
   * voiceover cache stays valid when the tempo changes.
   */
  tempo: number;
}

/** The recorded phone. */
export interface Device {
  viewport: Viewport;
  /** Device pixels per CSS pixel. */
  scale: number;
  isMobile: boolean;
}

export interface EndCard {
  headline: string;
  url: string;
  note: string;
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

/** A film's data, validated by the `marketing.json` schema. */
export interface FilmScript {
  id: string;
  title: string;
  /** The recorded page, e.g. `/calculator`. */
  path: string;
  format: VideoFormat;
  device: Device;
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
  endCard: EndCard;
}

/** What happens on screen, sentence by sentence; a project's scene module exports it as `scene`. */
export type Scene = (director: Director) => Promise<void>;

export interface Film extends FilmScript {
  scene: Scene;
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
