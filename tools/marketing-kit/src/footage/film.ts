import type { VideoFormat } from "../compose/timeline.js";
import type { EndCard } from "../film.js";
import type { LoudnessTarget } from "./loudness.js";

/**
 * A footage film: filmed clips (a person talking to camera, b-roll) cut by their transcript into a captioned
 * vertical film. Built from `marketing.json` (`footage[]`) or passed to `renderFootageFilm` as it is.
 */

/** `talk`: someone speaks, so the cut follows the words. `broll`: pictures without speech, kept whole with a slow zoom. */
export const CLIP_ROLES = ["talk", "broll"] as const;

export type ClipRole = (typeof CLIP_ROLES)[number];

/**
 * How a clip whose aspect differs from the film's fills the frame: `crop` (scaled to cover, edges cut), `blur` (the
 * whole picture over a blurred, enlarged copy of itself) or `auto` (crop when the aspects are within 15 %, else blur).
 */
export const CLIP_FITS = ["auto", "crop", "blur"] as const;

export type ClipFit = (typeof CLIP_FITS)[number];

/**
 * How a segment of the cut starts: `cut` (hard), `fade` (a short cross-fade from the previous segment), `zoom` (a
 * punch-in that hides a jump cut inside one talking clip) or `whoosh` (a hard cut with the whoosh sound).
 */
export const CUT_TRANSITIONS = ["cut", "fade", "zoom", "whoosh"] as const;

export type CutTransition = (typeof CUT_TRANSITIONS)[number];

export interface FootageClip {
  /** Unique within the film; the EDL refers to the clip by it. */
  id: string;
  /** A local file (absolute path) or an `https://` URL, downloaded once into the build folder. */
  source: string;
  role: ClipRole;
  fit: ClipFit;
  /** The part of the source the film uses, in seconds; `end: null` is the source's end. */
  trim: { start: number; end: number | null };
  /** What the clip says, for `--placeholder` only: spread evenly over the clip as a free stand-in transcript. */
  script: string | null;
}

/** Where the music under the film comes from. `prompt` and `video` are paid (ElevenLabs Music, Video to Music). */
export type MusicSource =
  | { kind: "none" }
  | {
      kind: "file";
      /** A local audio file, or a video whose sound is the bed. */
      path: string;
      /**
       * The file's original name and content type, for the type check when the path has no extension (a storage key
       * such as `@softure-ai/files`' `getStorageKey`). Without them and without an extension, only the probe checks it.
       */
      fileName?: string;
      contentType?: string;
    }
  | { kind: "prompt"; prompt: string }
  | { kind: "video"; description: string; tags: string[] };

export interface FootageMusic {
  source: MusicSource;
  /** The music's volume while nobody speaks (0-1). */
  volume: number;
  /** The music's volume under speech (0-1). */
  duckedVolume: number;
  /** Seconds the music takes to go down before a stretch of speech. Absent: 0.25. */
  attack?: number;
  /** Seconds the music takes to come back up after a stretch of speech. Absent: 0.5. */
  release?: number;
}

/** How the transcript turns into the cut (`buildEdl`). */
export interface CutOptions {
  /** Words cut out wherever they stand, compared without case, punctuation and repeated letters. */
  fillers: string[];
  /** A silence between two words longer than this is cut (seconds). */
  pauseSeconds: number;
  /** Seconds kept before the first and after the last word of every kept run. */
  padSeconds: number;
  /** The cut's longest length in seconds; later segments are shortened or dropped. Null: no limit. */
  maxSeconds: number | null;
}

/** Default transitions by kind of cut; a segment of the EDL may name its own. */
export interface FootageTransitions {
  /** A cut inside one talking clip (a removed filler or pause). */
  jump: CutTransition;
  /** A cut from one clip to another. */
  clip: CutTransition;
}

export interface FootageFilm {
  id: string;
  title: string;
  format: VideoFormat;
  /** ISO 639 code the clips speak (`pl`, `en`): the transcript's language and the default fillers. */
  language: string;
  clips: FootageClip[];
  /** Clean the talking clips' voice (ElevenLabs Voice Isolator, paid) before transcribing them. */
  isolateVoice: boolean;
  /**
   * Names and brand words the transcript should spell as given (Scribe keyterm prompting, billed on top of the
   * transcription). Checked against `SCRIBE_KEYTERM_LIMITS`; absent or empty: none.
   */
  keyTerms?: string[];
  cut: CutOptions;
  transitions: FootageTransitions;
  music: FootageMusic;
  /** Captions from the transcript. */
  captions: boolean;
  /** `phrase` (the default): 2-6 words of plain text with a soft shadow; `highlight`: a pill that lights each word as it is said. */
  captionStyle?: CaptionStyle;
  /** Places the 9:16 caption box inside a platform's safe zone (`CAPTION_SAFE_ZONES`); absent: the layout as it is. */
  captionPreset?: CaptionPreset;
  /**
   * The most lines a caption card may take: the render shrinks a longer card's font (to at most
   * `CAPTION_MIN_FONT_SCALE` of the box's size) until it fits. Absent: no limit. The draft keeps its font size.
   */
  captionMaxLines?: number;
  /** The cut's look: zoom size, fade length, Ken Burns, the end card's whoosh. Absent fields take `DEFAULT_EDIT`. */
  edit?: Partial<FootageEdit>;
  /** The closing card after the last segment; null: the film ends with its last segment. */
  endCard: EndCard | null;
  /** The speech track's loudness, normalized before the music is mixed under it. Absent: −14 LUFS, −1 dBTP; null: left as filmed. */
  loudness?: LoudnessTarget | null;
  /**
   * The finished film's mix (speech, music, sound effects), measured after the render and normalized in two passes of
   * `loudnorm` (one linear gain; the picture is copied, only the sound re-encoded), so the published file plays at the
   * target. A silent mix is left as it is. Absent: −14 LUFS, −1 dBTP; null: the mix as rendered.
   */
  mixLoudness?: LoudnessTarget | null;
  /**
   * The cover JPG written next to the film. Absent or without `at`: the middle of the first talking segment; `at`:
   * that second of the film; null: no cover.
   */
  cover?: { at?: number } | null;
}

/** Filler words per language, written with repeated letters collapsed (`yyy` and `yyyy` are both `y`). */
export const DEFAULT_FILLERS: Record<string, string[]> = {
  pl: ["y", "e", "yhm", "yh", "ym", "em", "hm", "mhm", "eh", "uh"],
  en: ["um", "uh", "uhm", "er", "erm", "hm", "mhm", "ah"],
};

/** The default fillers of a language; none for a language without a list. */
export function getDefaultFillers(language: string): string[] {
  return DEFAULT_FILLERS[language] ?? [];
}

export const DEFAULT_CUT: Omit<CutOptions, "fillers"> = { pauseSeconds: 0.6, padSeconds: 0.12, maxSeconds: null };

/** Hard cuts everywhere: an ordinary phone video, not a promo. */
export const DEFAULT_TRANSITIONS: FootageTransitions = { jump: "cut", clip: "cut" };

export const CAPTION_STYLES = ["phrase", "highlight"] as const;

export type CaptionStyle = (typeof CAPTION_STYLES)[number];

/** The smallest a caption line limit shrinks a card's font to, as a share of the caption box's size. */
export const CAPTION_MIN_FONT_SCALE = 0.7;

export const CAPTION_PRESETS = ["reels", "shorts", "tiktok", "all"] as const;

export type CaptionPreset = (typeof CAPTION_PRESETS)[number];

export interface FootageEdit {
  /** How far a `zoom` cut punches in, in percent of the frame (105-110). */
  zoomPercent: number;
  /** A `fade` cut's length in frames at 30 fps (1-30). */
  fadeFrames: number;
  /** How far b-roll zooms over its length (0-5 %); 0 keeps b-roll still and `buildEdl` marks none `kenburns`. */
  kenBurnsPercent: number;
  /** Play the whoosh (and pop) as the end card comes in. */
  isEndCardWhoosh: boolean;
}

export const DEFAULT_EDIT: FootageEdit = { zoomPercent: 108, fadeFrames: 10, kenBurnsPercent: 0, isEndCardWhoosh: false };

/** The film's edit settings with the defaults filled in. */
export function getFootageEdit(film: Pick<FootageFilm, "edit">): FootageEdit {
  return { ...DEFAULT_EDIT, ...film.edit };
}

export const DEFAULT_MUSIC_VOLUME = { volume: 0.35, duckedVolume: 0.1 } as const;
