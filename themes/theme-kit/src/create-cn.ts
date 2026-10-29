import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

import type { ThemeDefinition } from "./theme-definition.js";

export type { ClassValue } from "clsx";

export interface CnOptions {
  /** The theme's named text styles, so `text-body` (a size) and `text-muted-foreground` (a colour) both stay. */
  textStyles?: readonly string[];
  /** The theme's named shadows, so a later `shadow-card` replaces an earlier `shadow-menu`. */
  shadows?: readonly string[];
  /** The theme's named sizes (spacing values), so a later `size-touch-target` replaces an earlier `size-7`. */
  sizes?: readonly string[];
}

export type Cn = (...inputs: ClassValue[]) => string;

/**
 * shadcn/ui's `cn` for a theme: joins class names and lets a later Tailwind utility win over an earlier one of the
 * same kind, knowing the theme's own text styles, shadows and sizes.
 */
export function createCn({ textStyles = [], shadows = [], sizes = [] }: CnOptions = {}): Cn {
  const mergeClasses = extendTailwindMerge({
    extend: { theme: { text: [...textStyles], shadow: [...shadows], spacing: [...sizes] } },
  });
  return (...inputs) => mergeClasses(clsx(inputs));
}

/** `createCn` with the text styles, shadows and sizes a theme definition names. */
export function createThemeCn(
  definition: Pick<ThemeDefinition, "textStyles" | "shadows"> & Partial<Pick<ThemeDefinition, "sizes">>,
): Cn {
  return createCn({
    textStyles: Object.keys(definition.textStyles),
    shadows: Object.keys(definition.shadows),
    sizes: Object.keys(definition.sizes ?? {}),
  });
}
