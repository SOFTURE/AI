import { getThemeColor, type ThemeDefinition } from "@softure-ai/theme-kit";

import { getIconPath, getIconSizes, PWA_ICONS } from "./icons.js";

/** The app's own copy, from its message dictionary. */
export interface ManifestCopy {
  readonly name: string;
  /** The label under the home screen icon: 12 characters or fewer reads in full on most launchers. */
  readonly shortName: string;
  readonly description: string;
}

export type ManifestDisplay = "standalone" | "fullscreen" | "minimal-ui" | "browser";

export interface ManifestOptions {
  /** Any theme that meets the contract (`theme` from `@softure-ai/theme-<name>`). */
  readonly theme: Pick<ThemeDefinition, "name" | "colors">;
  readonly copy: ManifestCopy;
  /** The copy's language, e.g. `en` or `pl`. */
  readonly lang: string;
  /** `/` by default. */
  readonly startUrl?: string;
  /** `/` by default. */
  readonly scope?: string;
  /** `standalone` by default. */
  readonly display?: ManifestDisplay;
  /** The colour role of the splash screen: `background` by default. */
  readonly backgroundRole?: string;
  /** The colour role of the system bars: `background` by default. */
  readonly themeRole?: string;
}

export interface ManifestIcon {
  readonly src: string;
  readonly sizes: string;
  readonly type: "image/png";
  readonly purpose: "any" | "maskable";
}

/** A web app manifest (W3C), the fields this package fills. */
export interface WebAppManifest {
  readonly id: string;
  readonly name: string;
  readonly short_name: string;
  readonly description: string;
  readonly lang: string;
  readonly start_url: string;
  readonly scope: string;
  readonly display: ManifestDisplay;
  readonly background_color: string;
  readonly theme_color: string;
  readonly icons: readonly ManifestIcon[];
}

/**
 * The manifest from the theme's token values and the app's copy. The installer reads it outside the page, so the
 * colours are values (the light scheme's), not CSS variables.
 */
export function buildManifest({
  theme,
  copy,
  lang,
  startUrl = "/",
  scope = "/",
  display = "standalone",
  backgroundRole = "background",
  themeRole = "background",
}: ManifestOptions): WebAppManifest {
  return {
    id: startUrl,
    name: copy.name,
    short_name: copy.shortName,
    description: copy.description,
    lang,
    start_url: startUrl,
    scope,
    display,
    background_color: getThemeColor(theme, backgroundRole),
    theme_color: getThemeColor(theme, themeRole),
    icons: PWA_ICONS.flatMap((icon) =>
      icon.purpose === null ? [] : [{ src: getIconPath(icon), sizes: getIconSizes(icon), type: "image/png" as const, purpose: icon.purpose }],
    ),
  };
}
