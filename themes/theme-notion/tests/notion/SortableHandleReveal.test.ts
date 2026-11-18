import { fileURLToPath } from "node:url";

import { buildThemeStylesheet } from "@softure-ai/theme-kit/build";
import { __unstable__loadDesignSystem } from "@tailwindcss/node";
import { beforeAll, describe, expect, it } from "vitest";

import { NOTION_THEME } from "../../src/index.js";

const PACKAGE_DIR = fileURLToPath(new URL("../..", import.meta.url));

type DesignSystem = Awaited<ReturnType<typeof __unstable__loadDesignSystem>>;
let designSystem: DesignSystem;

beforeAll(async () => {
  const css = `@import "tailwindcss" source(none);\n${buildThemeStylesheet({ theme: NOTION_THEME, sources: [], imports: ["tw-animate-css"] })}`;
  designSystem = await __unstable__loadDesignSystem(css, { base: PACKAGE_DIR });
});

function getCss(candidate: string): string {
  const [css] = designSystem.candidatesToCss([candidate]);
  if (css === null || css === undefined) throw new Error(`getCss failed: Tailwind generates no CSS for ${candidate}`);
  return css.replace(/\s+/g, " ");
}

// happy-dom evaluates no media queries, so the reveal is checked on the CSS an app's Tailwind generates.
describe("SortableHandle reveal=hover CSS", () => {
  it("hides the grip only under a fine pointer, so a touch screen always shows it", () => {
    const css = getCss("pointer-fine:opacity-0");

    expect(css).toContain("@media (pointer: fine)");
    expect(css).toContain("opacity: 0%");
  });

  it.each([
    ["group-hover/sortable-item", ":hover"],
    ["group-focus-within/sortable-item", ":focus-within"],
    ["group-data-dragging/sortable-item", "[data-dragging]"],
  ])("shows the grip again under %s", (variant, state) => {
    const css = getCss(`pointer-fine:${variant}:opacity-100`);

    expect(css).toContain("@media (pointer: fine)");
    expect(css).toContain(`.group\\/sortable-item`);
    expect(css).toContain(state);
    expect(css).toContain("opacity: 100%");
  });
});
