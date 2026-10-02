import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  Button,
  type ButtonSize,
  type ButtonVariant,
  ButtonLink,
  CheckIcon,
  getButtonClass,
  IconButton,
  type LinkComponentProps,
} from "../src/index.js";

/** How React escapes an attribute value (`&`, `<`, `>`, `"`). */
function escapeHtml(text: string): string {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

const VARIANTS: readonly ButtonVariant[] = ["primary", "secondary", "ghost", "danger"];
const SIZES: readonly ButtonSize[] = ["sm", "md", "lg"];

/** The size classes of a class list: height, padding, gap, radius, text size, icon size. */
function getSizeClasses(classes: string): string[] {
  return classes
    .split(" ")
    .filter((name) => /^sft:(h-|px-|py-|gap-|rounded-|text-(xs|sm|base)$|\[&>svg\]:size-)/.test(name));
}

describe("Button sizes", () => {
  it("gives every variant of a size the same size classes", () => {
    for (const size of SIZES) {
      const sets = VARIANTS.map((variant) => getSizeClasses(getButtonClass({ variant, size })).join(" "));
      expect(new Set(sets).size, size).toBe(1);
    }
  });

  it("takes its height from one fixed h-* per size, without vertical padding", () => {
    expect(SIZES.map((size) => getButtonClass({ variant: "primary", size }).match(/sft:h-\d+/g))).toEqual([
      ["sft:h-8"],
      ["sft:h-10"],
      ["sft:h-12"],
    ]);
    for (const variant of VARIANTS) expect(getButtonClass({ variant })).not.toMatch(/sft:py-/);
  });
});

describe("Button markup", () => {
  it("marks variant and size with data attributes and renders the label as a direct child", () => {
    const html = renderToStaticMarkup(
      <Button variant="secondary" size="sm">
        Save
      </Button>,
    );
    expect(html).toMatch(/^<button type="button" data-variant="secondary" data-size="sm" class="sft:[^"]*">Save<\/button>$/);
  });

  it("does not submit a form unless asked to", () => {
    expect(renderToStaticMarkup(<Button variant="primary">Go</Button>)).toContain('type="button"');
    expect(
      renderToStaticMarkup(
        <Button variant="primary" type="submit">
          Go
        </Button>,
      ),
    ).toContain('type="submit"');
  });

  it("while pending shows a spinner instead of the left icon, disables itself and keeps the label", () => {
    const html = renderToStaticMarkup(
      <Button variant="primary" pending iconLeft={<CheckIcon className="left-icon" />}>
        Save
      </Button>,
    );
    expect(html).toContain('disabled=""');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('<svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false" class="sft:animate-spin');
    expect(html).not.toContain("left-icon");
    expect(html).toMatch(/<\/svg>Save<\/button>$/);
  });

  it("is not busy and not disabled when idle", () => {
    const html = renderToStaticMarkup(<Button variant="primary">Save</Button>);
    expect(html).not.toContain("aria-busy=");
    expect(html).not.toContain('disabled=""');
  });

  it("keeps icons decorative, so the label stays the name", () => {
    const html = renderToStaticMarkup(
      <Button variant="ghost" iconRight={<CheckIcon />}>
        Done
      </Button>,
    );
    expect(html).toMatch(/Done<svg [^>]*aria-hidden="true"/);
  });

  it("adds slot classes to the defaults, or renders only them when unstyled", () => {
    expect(renderToStaticMarkup(<Button variant="primary" classNames={{ root: "app-btn" }} />)).toMatch(
      /class="sft:[^"]* app-btn"/,
    );
    expect(renderToStaticMarkup(<Button variant="primary" unstyled classNames={{ root: "app-btn" }} />)).toContain(
      'class="app-btn"',
    );
    expect(renderToStaticMarkup(<Button variant="primary" unstyled />)).not.toContain("class=");
  });

  it("wraps a long label only when asked", () => {
    expect(getButtonClass({ variant: "primary" })).toContain("sft:whitespace-nowrap");
    expect(getButtonClass({ variant: "primary", wrap: true })).toContain("sft:whitespace-normal");
  });
});

describe("ButtonLink", () => {
  it("renders a plain anchor with the button's size classes by default", () => {
    const html = renderToStaticMarkup(
      <ButtonLink variant="secondary" size="lg" href="/pricing">
        Pricing
      </ButtonLink>,
    );
    expect(html).toBe(
      `<a href="/pricing" data-variant="secondary" data-size="lg" class="${escapeHtml(getButtonClass({ variant: "secondary", size: "lg" }))}">Pricing</a>`,
    );
  });

  it("renders through the injected LinkComponent", () => {
    function AppLink({ href, children, ...rest }: LinkComponentProps) {
      return (
        <a {...rest} href={href} data-app-link="">
          {children}
        </a>
      );
    }
    const html = renderToStaticMarkup(
      <ButtonLink variant="primary" href="/a" LinkComponent={AppLink}>
        Open
      </ButtonLink>,
    );
    expect(html).toMatch(/^<a data-variant="primary" data-size="md" class="sft:[^"]*" href="\/a" data-app-link="">Open<\/a>$/);
  });
});

describe("IconButton", () => {
  it("carries its name in aria-label and has no native tooltip", () => {
    const html = renderToStaticMarkup(
      <IconButton label="Delete row">
        <CheckIcon />
      </IconButton>,
    );
    expect(html).toContain('aria-label="Delete row"');
    expect(html).toContain('type="button"');
    expect(html).not.toContain("title=");
  });

  it("gives row (sm) and standalone (md) targets the same 32 px box", () => {
    const sizeOf = (size: "sm" | "md" | "lg") =>
      renderToStaticMarkup(
        <IconButton label="x" size={size}>
          <CheckIcon />
        </IconButton>,
      ).match(/sft:size-\d+/)?.[0];
    expect([sizeOf("sm"), sizeOf("md"), sizeOf("lg")]).toEqual(["sft:size-8", "sft:size-8", "sft:size-11"]);
  });

  it("differs between tones only in colour classes", () => {
    const classesOf = (tone: "neutral" | "danger") =>
      (renderToStaticMarkup(
        <IconButton label="x" tone={tone}>
          <CheckIcon />
        </IconButton>,
      ).match(/class="([^"]*)"/)?.[1] ?? "")
        .split(" ")
        .filter((name) => !/(text|bg)-/.test(name));
    expect(classesOf("danger")).toEqual(classesOf("neutral"));
  });
});

describe("button.tsx", () => {
  it("is a server module: no use client directive and no hooks", () => {
    const source = readFileSync(join(import.meta.dirname, "../src/ui/button.tsx"), "utf8");
    expect(source).not.toMatch(/^"use client"/);
    expect(source).not.toMatch(/\buse[A-Z]\w*\(/);
  });
});
