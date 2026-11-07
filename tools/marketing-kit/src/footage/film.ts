import type { VideoFormat } from "../compose/timeline.js";
import type { EndCard } from "../film.js";
import type { DeclickLevel } from "./declick.js";
import type { LoudnessTarget, MixLoudnessTarget } from "./loudness.js";

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

/** A jump cut's default: a transition, or `auto` to choose `zoom` or `fade` from the frames around each cut. */
export const JUMP_TRANSITIONS = [...CUT_TRANSITIONS, "auto"] as const;

export type JumpTransition = (typeof JUMP_TRANSITIONS)[number];

/** Default transitions by kind of cut; a segment of the EDL may name its own. */
export interface FootageTransitions {
  /**
   * A cut inside one talking clip (a removed filler or pause). `auto`: when the cut is built, the frames on both sides
   * are compared (`chooseCutTransitions`): a small difference gets a `zoom`, a large one (the camera moved) a `fade`.
   */
  jump: JumpTransition;
  /** A cut from one clip to another. */
  clip: CutTransition;
  /** With `jump: "auto"`, the frame difference (0-1) from which a jump cut fades instead of zooming; default 0.08. */
  autoThreshold?: number;
}

/** The frame difference (0-1) from which an `auto` jump cut fades instead of zooming. */
export const DEFAULT_AUTO_THRESHOLD = 0.08;

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
  /**
   * Words a caption card must not end on: the card hands them to the next one, so `w` stays with `domu`. Compared
   * lower-case; a number always keeps with the word after it. Absent: the language's `DEFAULT_CAPTION_KEEP_WITH_NEXT`;
   * empty: numbers only.
   */
  captionKeepWithNext?: string[];
  /** The cut's look: zoom size, fade length, Ken Burns, the end card's whoosh. Absent fields take `DEFAULT_EDIT`. */
  edit?: Partial<FootageEdit>;
  /** The closing card after the last segment (`FootageEndCard`); null: the film ends with its last segment. */
  endCard: FootageEndCard | null;
  /** The speech track's cleanup before its loudness normalization. Absent: none. */
  speech?: FootageSpeech;
  /** The speech track's loudness, normalized before the music is mixed under it. Absent: −14 LUFS, −1 dBTP; null: left as filmed. */
  loudness?: LoudnessTarget | null;
  /**
   * The finished film's mix (speech, music, sound effects), measured after the render and normalized in two passes of
   * `loudnorm` (one linear gain; the picture is copied, only the sound re-encoded), so the published file plays at the
   * target. A silent mix is left as it is. Absent: −14 LUFS, −1 dBTP; null: the mix as rendered. `keep: "speech"`
   * applies no gain while the mix measures inside `target ± tolerance` (default 1 LU), so the speech keeps its level
   * whatever the music volume (see `MixLoudnessTarget`).
   */
  mixLoudness?: MixLoudnessTarget | null;
  /**
   * The cover JPG written next to the film. Absent or without `at`: the middle of the first talking segment; `at`:
   * that second of the film; null: no cover.
   */
  cover?: { at?: number } | null;
}

/**
 * The closing card after a footage film's last segment, over the cut's last frame. No speech plays under it; the
 * music plays on. `layout` tells the two shapes apart (`"full"` when absent).
 */
export type FootageEndCard = FullFootageEndCard | LogoFootageEndCard;

/** The brand row, the headline, the link pill and the note (`layout` absent or `"full"`). */
export interface FullFootageEndCard extends EndCard {
  layout?: "full";
  /** The card's length in seconds (1-3); absent: `DEFAULT_END_CARD_SECONDS`. The entrances keep pace with it. */
  seconds?: number;
}

/**
 * A short brand card (issue #1173): the logo and one optional line on the brand's background, fading in, inside the
 * 9:16 platform safe zone; the music fades out under it to the film's end.
 */
export interface LogoFootageEndCard {
  layout: "logo";
  /** One short line under the logo ("Follow for more"), in the heading font; empty: the logo alone. */
  line: string;
  /** The card's logo, a PNG (with alpha) or an SVG file; absent: the brand's logo, or the brand name without one. */
  logo?: string;
  /** The card's length in seconds (1-3); absent: `DEFAULT_LOGO_END_CARD_SECONDS`. */
  seconds?: number;
  /** How long the card fades in over the last frame, in seconds; absent: `DEFAULT_LOGO_END_CARD_FADE_SECONDS`. */
  fadeSeconds?: number;
}

/** The full end card's length when it sets none. */
export const DEFAULT_END_CARD_SECONDS = 3;
/** The logo card's length when it sets none. */
export const DEFAULT_LOGO_END_CARD_SECONDS = 1.5;
/** The logo card's fade in when it sets none. */
export const DEFAULT_LOGO_END_CARD_FADE_SECONDS = 0.2;

/** The end card's length in seconds: 0 without a card, else its `seconds` or its layout's default. */
export function getEndCardSeconds(card: FootageEndCard | null): number {
  if (card === null) return 0;
  return card.seconds ?? (card.layout === "logo" ? DEFAULT_LOGO_END_CARD_SECONDS : DEFAULT_END_CARD_SECONDS);
}

/**
 * The end card's texts in the shape the glyph check reads (`findMissingCaptionGlyphs`): the logo card's line is drawn
 * in the heading font, like the full card's headline; it has no url or note.
 */
export function getEndCardTexts(card: FootageEndCard | null): { headline: string; url: string; note: string } | null {
  if (card === null) return null;
  if (card.layout !== "logo") return { headline: card.headline, url: card.url, note: card.note };
  return { headline: card.line, url: "", note: "" };
}

/** Settings of the speech track itself. */
export interface FootageSpeech {
  /**
   * Mouth clicks and lip smacks between words (issues #1084, #1170, #1183): each single impulse in a pause is repaired
   * by AR interpolation and no gain changes. `gentle` and `strong` repair impulses that jump 15 or 9 dB above the band's
   * median, nothing within 80 ms of a transcript word; `repair` uses the shared mouth-click rules (`MOUTH_CLICK_RULES`):
   * word bounds on the real sound, nothing above -45 dBFS, pauses of 150 ms or more, at most 3 repairs a second and
   * 1 % of the track. Absent or `off`: no pass, the track unchanged.
   */
  declick?: DeclickLevel;
}

/** The film's declick level; `off` when it sets none. */
export function getDeclickLevel(film: Pick<FootageFilm, "speech">): DeclickLevel {
  return film.speech?.declick ?? "off";
}

/** Filler words per language, written with repeated letters collapsed (`yyy` and `yyyy` are both `y`). */
export const DEFAULT_FILLERS: Record<string, string[]> = {
  pl: ["y", "e", "yhm", "yh", "ym", "em", "hm", "mhm", "eh", "uh"],
  en: ["um", "uh", "uhm", "er", "erm", "hm", "mhm", "ah"],
};

/**
 * Words a caption card does not end on, per language: Polish one-letter words and short prepositions, English
 * articles. A language without a list keeps numbers only.
 */
export const DEFAULT_CAPTION_KEEP_WITH_NEXT: Record<string, string[]> = {
  pl: ["a", "i", "o", "u", "w", "z", "we", "ze", "na", "do", "od", "po", "za", "ku"],
  en: ["a", "an", "the"],
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
  /** How far a `zoom` cut punches in, in percent of the frame (105-112). */
  zoomPercent: number;
  /**
   * Frames at 30 fps a `zoom` cut eases into its scale over, from the scale on screen before the cut (0-15); 0 steps
   * straight to it. A `kenburns` segment keeps its own slow zoom and is not eased.
   */
  zoomEaseFrames: number;
  /** A `fade` cut's length in frames at 30 fps (1-30). */
  fadeFrames: number;
  /** How far b-roll zooms over its length (0-5 %); 0 keeps b-roll still and `buildEdl` marks none `kenburns`. */
  kenBurnsPercent: number;
  /** Play the whoosh (and pop) as the end card comes in. */
  isEndCardWhoosh: boolean;
  /** The speech track's fade at every cut, in milliseconds (10-100). */
  cutAudioFadeMs: number;
  /**
   * Cross-fade the two sides of every cut over `cutAudioFadeMs`, centred on the cut, instead of fading each side out
   * and in (a short dip). The speech stays where the picture is.
   */
  isCutAudioCrossfade: boolean;
}

export const DEFAULT_EDIT: FootageEdit = { zoomPercent: 108, zoomEaseFrames: 0, fadeFrames: 10, kenBurnsPercent: 0, isEndCardWhoosh: false, cutAudioFadeMs: 20, isCutAudioCrossfade: false };

/** The film's edit settings with the defaults filled in. */
export function getFootageEdit(film: Pick<FootageFilm, "edit">): FootageEdit {
  return { ...DEFAULT_EDIT, ...film.edit };
}

export const DEFAULT_MUSIC_VOLUME = { volume: 0.35, duckedVolume: 0.1 } as const;
