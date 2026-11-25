import { X } from "lucide-react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PALETTE_COLORS } from "../../src/notion/palette.js";

import { Status } from "../../src/notion/Status.js";
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

  it.each(["default", ...PALETTE_COLORS] as const)(
    "keeps a destructive badge on its own fill and text with color %s",
    (color) => {
      const html = renderToStaticMarkup(
        <Badge variant="destructive" color={color}>
          Overdue
        </Badge>,
      );

      expect(html).toContain("bg-destructive text-destructive-foreground");
      expect(html).toContain("dark:bg-destructive/60");
      expect(html).not.toMatch(/-tag\b|-tag-foreground/);
    },
  );

  it.each(["default", "secondary", "outline", "ghost", "link"] as const)(
    "draws the colour's tag on the %s variant",
    (variant) => {
      const html = renderToStaticMarkup(
        <Badge variant={variant} color="red">
          Late
        </Badge>,
      );

      expect(html).toContain("bg-red-tag text-red-tag-foreground");
    },
  );

  it.each(["default", "secondary", "destructive", "outline", "ghost", "link", "tag"] as const)(
    "caps the %s badge at its container's width, on one line, a cut text keeping its start",
    (variant) => {
      const html = renderToStaticMarkup(<Badge variant={variant}>Observation, day 1 of 30</Badge>);

      expect(html).toMatch(/class="[^"]*\bmax-w-full\b/);
      expect(html).toMatch(/class="[^"]*\bjustify-center-safe\b/);
      expect(html).toMatch(/class="[^"]*\bw-fit\b/);
      expect(html).toMatch(/class="[^"]*\bwhitespace-nowrap\b/);
    },
  );

  it.each(PALETTE_COLORS)("names its %s colour in data-color, next to its variant", (color) => {
    const html = renderToStaticMarkup(
      <Badge variant="tag" color={color}>
        Passed
      </Badge>,
    );

    expect(html).toContain(`data-color="${color}"`);
    expect(html).toContain('data-variant="tag"');
  });

  it.each([undefined, null, "none"] as const)("sets no data-color with color %s", (color) => {
    const html = renderToStaticMarkup(
      <Badge variant="tag" color={color}>
        Passed
      </Badge>,
    );

    expect(html).not.toContain("data-color");
  });

  it("lets a caller's own data-color win", () => {
    const html = renderToStaticMarkup(
      <Badge variant="tag" color="red" data-color="green">
        Passed
      </Badge>,
    );

    expect(html).toContain('data-color="green"');
    expect(html).not.toContain('data-color="red"');
  });

  it("names a colour the same way as Status", () => {
    const badge = renderToStaticMarkup(
      <Badge variant="tag" color="red">
        Failed
      </Badge>,
    );
    const status = renderToStaticMarkup(
      <Status color="red" icon={X}>
        Failed
      </Status>,
    );

    expect(badge).toContain('data-color="red"');
    expect(status.match(/data-color="red"/g)).toHaveLength(1);
  });
});
