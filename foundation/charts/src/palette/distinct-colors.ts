// Colours for an open set of keys (bands, categories): a key keeps its colour whatever order the keys come in, and two
// keys share a colour only once the palette runs out. `seriesSlot(index)` cannot do this: it follows position, so a
// band's colour moves when another band appears before it.
import { SERIES_SLOTS } from "./series-tokens.js";

/** The series slots, 1 to `SERIES_SLOTS`: the default palette of `distinctColors`. */
const SLOT_PALETTE: readonly number[] = Array.from({ length: SERIES_SLOTS }, (_, index) => index + 1);

/**
 * A colour per key: series slots (1 to `SERIES_SLOTS`) by default, or the values of `palette` (CSS colours, slots,
 * class names). Each key hashes to a preferred colour; keys are placed in sorted order, and a key whose preference is
 * taken gets the next free colour. So the result does not depend on the keys' order, and a key keeps its colour when
 * another joins unless the newcomer sorts before it and takes that colour first. Repeated keys count once; past the
 * palette's size colours repeat, still deterministically. Throws a `RangeError` for an empty palette.
 */
export function distinctColors(keys: readonly string[]): Map<string, number>;
export function distinctColors<T>(keys: readonly string[], palette: readonly T[]): Map<string, T>;
export function distinctColors<T>(keys: readonly string[], palette?: readonly T[]): Map<string, T | number> {
  const colours: readonly (T | number)[] = palette ?? SLOT_PALETTE;
  if (colours.length === 0) throw new RangeError("distinctColors: the palette is empty");
  const assigned = new Map<string, T | number>();
  const sorted = [...new Set(keys)].sort();
  for (let start = 0; start < sorted.length; start += colours.length) {
    // One round per palette's worth of keys: within a round every colour is used at most once.
    const taken = new Set<number>();
    for (const key of sorted.slice(start, start + colours.length)) {
      let slot = hashKey(key) % colours.length;
      while (taken.has(slot)) slot = (slot + 1) % colours.length;
      taken.add(slot);
      assigned.set(key, colours[slot] as T | number);
    }
  }
  return assigned;
}

/** FNV-1a over the key's UTF-16 code units: a small, stable hash (no security role). */
function hashKey(key: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}
