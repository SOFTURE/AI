import { createThemeCn } from "@softure-ai/theme-kit";

import { NOTION_THEME } from "../tokens.js";

/**
 * shadcn/ui's `cn` for the Notion theme: a later Tailwind utility wins over an earlier one of the same kind, and the
 * theme's named text styles (`text-body`) and shadows (`shadow-menu`) merge as their own kinds.
 */
export const cn = createThemeCn(NOTION_THEME);
