import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PALETTE_COLORS } from "../../src/notion/palette.js";

import { Badge } from "../../src/ui/badge.js";

describe("Badge", () => {
  it.each(PALETTE_COLORS)("draws a %s tag on the palette's tag tokens", (color) => {
    const html = renderToStaticMarkup(
      <Badge variant="tag" color={color}>
        Marketing
      </Badge>,
    );

    expect(html).toContain('data-variant="tag"');
    expect(html).toContain(`bg-${color}-tag text-${color}-tag-foreground`);
    expect(html).toContain("rounded-xs");
  });

  it("adds no palette colour unless one is asked for", () => {
    const html = renderToStaticMarkup(<Badge variant="secondary">3</Badge>);

    expect(html).toContain("bg-secondary");
    expect(html).not.toMatch(/-tag\b/);
  });
});
