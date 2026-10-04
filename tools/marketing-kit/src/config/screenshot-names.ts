import type { ColorTheme } from "./colors.js";

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

/** The names of the files the entry writes, whatever the app's colour scheme. */
export function getScreenshotNames(entry: ScreenshotNaming): string[] {
  return getScreenshotShots(entry, "light").map((shot) => shot.name);
}
