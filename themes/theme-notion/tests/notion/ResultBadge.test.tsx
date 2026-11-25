import { Rocket } from "lucide-react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { readTextNodes } from "../support.js";

import { RESULT_BADGE_ICONS, ResultBadge } from "../../src/notion/ResultBadge.js";
import { TONES } from "../../src/notion/tones.js";

function readBadge(html: string): string {
  const match = /<span [^>]*data-slot="result-badge"[^>]*>/.exec(html);
  if (match === null) throw new Error(`No result badge in ${html}`);
  return match[0];
}

describe("ResultBadge (#1481)", () => {
  it("fills a tag in the tone's palette colour, one colour per tone", () => {
    const colours = Object.fromEntries(
      TONES.map((tone) => {
        const badge = readBadge(renderToStaticMarkup(<ResultBadge tone={tone}>Word</ResultBadge>));
        return [tone, /data-color="([^"]*)"/.exec(badge)?.[1]];
      }),
    );

    expect(colours).toEqual({ default: "default", success: "green", warning: "orange", danger: "red", muted: "gray" });
  });

  it("is a filled tag, never a ghost or a plain text colour", () => {
    const badge = readBadge(renderToStaticMarkup(<ResultBadge tone="danger">Failed</ResultBadge>));

    expect(badge).toContain('data-variant="tag"');
    expect(badge).toContain('data-tone="danger"');
    expect(badge).toMatch(/class="[^"]*\bbg-red-tag\b[^"]*\btext-red-tag-foreground\b/);
  });

  it("draws the tone's default icon, hidden, and always the word", () => {
    const icons = Object.fromEntries(
      TONES.map((tone) => {
        const html = renderToStaticMarkup(<ResultBadge tone={tone}>Word</ResultBadge>);
        return [tone, /lucide-([a-z-]+)/.exec(html)?.[1]];
      }),
    );
    const html = renderToStaticMarkup(<ResultBadge tone="success">Passed</ResultBadge>);

    expect(icons).toEqual({ default: "circle", success: "circle-check", warning: "triangle-exclamation-point", danger: "circle-x", muted: "circle-minus" });
    expect(Object.keys(RESULT_BADGE_ICONS)).toEqual([...TONES]);
    expect(html).toMatch(/<svg[^>]*aria-hidden="true"/);
    expect(readTextNodes(html).join("")).toBe("Passed");
    expect(html).toContain('title="Passed"');
  });

  it("takes the app's own icon in place of the tone's", () => {
    const html = renderToStaticMarkup(
      <ResultBadge tone="success" icon={Rocket}>
        Deployed
      </ResultBadge>,
    );

    expect(html).toContain("lucide-rocket");
    expect(html).not.toContain("lucide-circle-check");
  });

  it("spins a loader for a run in progress, only when motion is welcome", () => {
    const html = renderToStaticMarkup(
      <ResultBadge tone="muted" isSpinning>
        Running
      </ResultBadge>,
    );
    const badge = readBadge(html);
    const icon = /<svg[^>]*>/.exec(html)?.[0] ?? "";

    expect(badge).toContain('data-color="gray"');
    expect(badge).toContain('data-spinning="true"');
    expect(icon).toContain("lucide-loader-circle");
    expect(icon).toMatch(/class="[^"]*\bmotion-safe:animate-spin\b/);
    expect(icon).not.toMatch(/class="[^"]*(?<![:\w-])animate-spin\b/);
  });

  it("spins the app's own icon too, and a resting badge never spins", () => {
    const spinning = renderToStaticMarkup(
      <ResultBadge tone="muted" icon={Rocket} isSpinning>
        Deploying
      </ResultBadge>,
    );
    const resting = renderToStaticMarkup(<ResultBadge tone="muted">Skipped</ResultBadge>);

    expect(spinning).toMatch(/<svg[^>]*lucide-rocket[^>]*motion-safe:animate-spin/);
    expect(resting).not.toContain("animate-spin");
    expect(readBadge(resting)).not.toContain("data-spinning");
  });
});
