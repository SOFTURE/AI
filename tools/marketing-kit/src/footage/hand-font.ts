import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { readFontTables, readUint16 } from "../og/font-tables.js";
import { createDraftTextMeasure, type DraftTextMeasure } from "./draft-text-width.js";

/**
 * The kit's handwriting: Caveat (SIL Open Font License 1.1, `fonts/LICENSE-Caveat.txt`), a static SemiBold instance
 * subset to Latin with every Polish letter. A note card and an end word are written in it in both paths: the draft
 * copies the file into its fonts folder (libass finds it by `family`), the render copies it to `asset` with its
 * `@font-face`.
 */
export const HAND_FONT = {
  family: "Caveat",
  // A path joined to this module's own path, not a URL relative to `import.meta.url`: a bundler (Turbopack in a Next.js
  // server) turns that URL into an asset object `fileURLToPath` refuses, which broke every page importing the kit.
  file: join(dirname(fileURLToPath(import.meta.url)), "../../fonts/Caveat-SemiBold-Latin.ttf"),
  asset: "assets/fonts/hand.ttf",
} as const;

/** Room left round a measured handwritten line: kerning and Caveat's contextual letters are not read. */
const HAND_WIDTH_SLACK = 1.04;

let handMetrics: { measure: DraftTextMeasure; toEm: number } | undefined;

/** The hand font's measure in CSS pixels and its libass-size-to-em ratio, read once from the kit's own file. */
function getHandMetrics(): { measure: DraftTextMeasure; toEm: number } {
  if (handMetrics !== undefined) return handMetrics;
  const font = readFileSync(/* turbopackIgnore: true */ HAND_FONT.file);
  const tables = readFontTables(font);
  const libass = createDraftTextMeasure(font);
  const head = tables.ok ? tables.value.get("head") : undefined;
  const os2 = tables.ok ? tables.value.get("OS/2") : undefined;
  if (libass === null || head === undefined || os2 === undefined) throw new Error(`the kit's hand font ${HAND_FONT.file} cannot be read`);
  // `createDraftTextMeasure` measures as libass sizes a font (by usWinAscent + usWinDescent); a browser sizes it by the em.
  const toEm = (readUint16(os2, 74) + readUint16(os2, 76)) / readUint16(head, 18);
  handMetrics = { measure: (text, fontSize) => Math.ceil(libass(text, fontSize * toEm) * HAND_WIDTH_SLACK), toEm };
  return handMetrics;
}

/** How wide `text` is written in the hand font at `fontSize` px in the render. */
export function measureHandText(text: string, fontSize: number): number {
  return getHandMetrics().measure(text, fontSize);
}

/** The draft's `\fs` for the hand font at the render's `fontSize`: libass sizes a font by its ascent and descent, so the letters match the render's. */
export function getHandFontAssSize(fontSize: number): number {
  return Math.round(fontSize * getHandMetrics().toEm);
}
