import { COLOR_THEMES, type ColorTheme } from "./colors.js";

/**
 * The files a `screenshots[]` entry writes: `<id>.png` in the app's colour scheme, or one
 * `<id>-<scheme>.png` per listed scheme. Pure, so the config check and the capture share the naming.
 */

export interface ScreenshotNaming {
  id: string;
  colorSchemes?: readonly ColorTheme[] | undefined;
}

/** One file, by its name without `.png`, and the scheme it is captured in. */
export interface ScreenshotShot {
  name: string;
  scheme: ColorTheme;
}

/** The entry's shots in the order they are taken. */
export function getScreenshotShots(entry: ScreenshotNaming, defaultScheme: ColorTheme): ScreenshotShot[] {
  if (entry.colorSchemes === undefined) return [{ name: entry.id, scheme: defaultScheme }];
  return entry.colorSchemes.map((scheme) => ({ name: `${entry.id}-${scheme}`, scheme }));
}

/**
 * Every name an entry with this id writes with or without `colorSchemes`: `<id>`, `<id>-light`,
 * `<id>-dark`. The capture removes all of them before an entry runs, so no two entries may share one.
 */
export function getScreenshotNames(id: string): string[] {
  return [id, ...COLOR_THEMES.map((scheme) => `${id}-${scheme}`)];
}
