import type { FootageDraftArgsInput } from "../../../src/footage/draft.js";
import type { Edl } from "../../../src/footage/edl.js";
import type { EdlSplit } from "../../../src/footage/split-screen.js";
import { DEFAULT_TRANSITIONS, type FootageFilm } from "../../../src/footage/film.js";
import type { ResolvedOverlay } from "../../../src/footage/overlays.js";

/**
 * Fictional cuts that reach every branch of the draft's picture graph (cut, zoom, fade, Ken Burns, eased zoom, camera,
 * punch-in, stutter, whip, card, paper, split screen, a clip shorter than its fade's tail), shared by the assembly tests.
 */

export const ASSEMBLY_FILM: FootageFilm = {
  id: "street",
  title: "Street",
  format: "9:16",
  language: "pl",
  clips: [],
  isolateVoice: false,
  cut: { fillers: [], pauseSeconds: 0.6, padSeconds: 0.1, maxSeconds: null },
  transitions: DEFAULT_TRANSITIONS,
  music: { source: { kind: "none" }, volume: 0.35, duckedVolume: 0.1 },
  captions: true,
  endCard: null,
};

const SPLIT: EdlSplit = {
  layout: "split3",
  bands: [
    { clip: "north", start: 0, label: "North beach" },
    { clip: "harbour", start: 1, label: "Harbour", focus: 0.2 },
    { clip: "hill", start: 0.5, label: "Hill" },
  ],
};

/** Every transition and move the draft draws, in one cut of twelve segments. */
export const ASSEMBLY_EDL: Edl = {
  version: 2,
  film: "street",
  segments: [
    { id: "a1", clip: "talk", start: 0.5, end: 2.5, transition: "cut", motion: "none" },
    { id: "a2", clip: "talk", start: 3, end: 4, transition: "zoom", motion: "none" },
    { id: "a3", clip: "talk", start: 5, end: 6, transition: "zoom", motion: "none" },
    { id: "a4", clip: "street", start: 0, end: 3, transition: "fade", motion: "kenburns" },
    { id: "a5", clip: "talk", start: 7, end: 8.2, transition: "whip", motion: "none" },
    { id: "a6", clip: "talk", start: 8.5, end: 10, transition: "stutter", motion: "none" },
    { id: "a7", clip: "street", start: 3, end: 5, transition: "card", motion: "none", camera: { from: 1, to: 1.2, ease: "out", anchor: { x: 0.4, y: 0.3 } } },
    { id: "a8", clip: "talk", start: 10.5, end: 12, transition: "paper", motion: "none" },
    { id: "a9", clip: "north", start: 0, end: 2, transition: "cut", motion: "none", split: SPLIT },
    { id: "a10", clip: "talk", start: 12.5, end: 14, transition: "fade", motion: "none" },
    { id: "a11", clip: "talk", start: 14.2, end: 15.1, transition: "cut", motion: "kenburns" },
    { id: "a12", clip: "street", start: 5, end: 6, transition: "fade", motion: "none" },
  ],
};

/** A punch-in over the second segment. */
export const ASSEMBLY_OVERLAYS: ResolvedOverlay[] = [{ index: 0, kind: "punch_in", start: 2.2, end: 2.8, segment: 1, scale: 1.12, ease: 0.2 }];

export function getAssemblyArgsInput(changes: Partial<FootageDraftArgsInput> = {}): FootageDraftArgsInput {
  return {
    film: ASSEMBLY_FILM,
    edl: ASSEMBLY_EDL,
    clips: { talk: "/clips/talk.mp4", street: "/clips/street.mp4", north: "/clips/north.mp4", harbour: "/clips/harbour.mp4", hill: "/clips/hill.mp4" },
    speech: "/draft/speech.wav",
    frame: { width: 1080, height: 1920 },
    captions: "captions.ass",
    fontsDir: "fonts",
    overlays: ASSEMBLY_OVERLAYS,
    splitLayers: { a9: "/draft/split-a9.png" },
    output: "/out/draft.mp4",
    ...changes,
  };
}
