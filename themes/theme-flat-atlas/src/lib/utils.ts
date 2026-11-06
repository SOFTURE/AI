import { createThemeCn } from "@softure-ai/theme-kit";

import { FLAT_ATLAS_THEME } from "../tokens.js";

/**
 * shadcn/ui's `cn` for the Flat Atlas theme: a later Tailwind utility wins over an earlier one of the same kind, and
 * the theme's named text styles (`text-subsection`) merge as their own kind.
 */
export const cn = createThemeCn(FLAT_ATLAS_THEME);
