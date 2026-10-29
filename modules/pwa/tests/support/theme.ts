import type { ThemeDefinition } from "@softure-ai/theme-kit";

/** The colours the package reads, as values: the manifest's and the icons'. */
export const THEME: Pick<ThemeDefinition, "name" | "colors"> = {
  name: "Test",
  colors: {
    background: { light: "#fefefe", dark: "#191919" },
    card: { light: "#f7f7f5", dark: "#202020" },
    primary: { light: "#0171cf", dark: "#2383e2" },
    "primary-foreground": { light: "#ffffff", dark: "#f0f0f0" },
    link: { alias: "primary" },
  },
};
