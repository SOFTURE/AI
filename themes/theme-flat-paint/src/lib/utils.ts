import { createThemeCn } from "@softure-ai/theme-kit";

import { FLAT_PAINT_THEME } from "../tokens.js";

/**
 * shadcn/ui's `cn` for the Flat Paint theme: a later Tailwind utility wins over an earlier one of the same kind, and
 * the theme's named text styles (`text-subsection`) and shadows (`shadow-selected-row`) merge as their own kinds.
 */
export const cn = createThemeCn(FLAT_PAINT_THEME);
