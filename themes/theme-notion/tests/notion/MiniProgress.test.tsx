import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { MiniProgress } from "../../src/notion/MiniProgress.js";

function readRoot(html: string): string {
  const match = /<div [^>]*data-slot="mini-progress"[^>]*>/.exec(html);
  if (match === null) throw new Error(`No mini-progress root in ${html}`);
  return match[0];
}

function readIndicator(html: string): string {
  const match = /<div [^>]*data-slot="mini-progress-indicator"[^>]*>/.exec(html);
  if (match === null) throw new Error(`No mini-progress indicator in ${html}`);
  return match[0];
}

function readLabels(html: string): string[] {
  return [...html.matchAll(/<span aria-hidden="true" data-slot="mini-progress-label"[^>]*>/g)].map((match) => match[0]);
}

describe("MiniProgress", () => {
  it("is a progress bar of 0 to 100 that reports its value and fills that share", () => {
    const html = renderToStaticMarkup(<MiniProgress value={40} aria-label="Cost share" />);
    const root = readRoot(html);

    expect(root).toContain('role="progressbar"');
    expect(root).toContain('aria-valuemin="0"');
    expect(root).toContain('aria-valuemax="100"');
    expect(root).toContain('aria-valuenow="40"');
    expect(root).toContain('aria-label="Cost share"');
    expect(readIndicator(html)).toContain("width:40%");
  });

  it.each([
    { value: -5, expected: 0 },
    { value: 140, expected: 100 },
    { value: Number.NaN, expected: 0 },
    { value: Number.POSITIVE_INFINITY, expected: 0 },
  ])("clamps $value to $expected in the fill, the clip and aria-valuenow", ({ value, expected }) => {
    const html = renderToStaticMarkup(<MiniProgress value={value} />);

    expect(readRoot(html)).toContain(`aria-valuenow="${expected}"`);
    expect(readIndicator(html)).toContain(`width:${expected}%`);
    expect(html).toContain(`clip-path:inset(0 ${100 - expected}% 0 0)`);
  });

  it("labels itself with the rounded percent by default, and Radix reads the percent", () => {
    const html = renderToStaticMarkup(<MiniProgress value={37.4} />);

    expect(html.match(/>37%</g)).toHaveLength(2);
    expect(readRoot(html)).toContain('aria-valuetext="37%"');
  });

  it("reads a string label as aria-valuetext, so the amount is announced and not only the percent", () => {
    const html = renderToStaticMarkup(<MiniProgress value={12} label="< 0.01 USD" />);

    expect(readRoot(html)).toContain('aria-valuetext="&lt; 0.01 USD"');
    expect(html.match(/>&lt; 0\.01 USD</g)).toHaveLength(2);
  });

  it("leaves aria-valuetext to the percent when the label is not a string", () => {
    const html = renderToStaticMarkup(<MiniProgress value={12} label={<b>4 USD</b>} />);

    expect(readRoot(html)).toContain('aria-valuetext="12%"');
    expect(html.match(/<b>4 USD<\/b>/g)).toHaveLength(2);
  });

  it("draws the label twice, hidden from assistive tech: on the track and clipped to the fill", () => {
    const html = renderToStaticMarkup(<MiniProgress value={30} label="30 h" />);
    const labels = readLabels(html);

    expect(labels).toHaveLength(2);
    expect(labels[0]).toContain("text-foreground");
    expect(labels[0]).not.toContain("clip-path");
    // The page background on the fill: white on the light fills, the dark page on the dark ones (AA in both).
    expect(labels[1]).toContain("text-background");
    expect(labels[1]).toContain('style="clip-path:inset(0 70% 0 0)"');
    for (const label of labels) {
      expect(label).toContain("absolute inset-0 flex items-center px-2 text-xs font-medium tabular-nums whitespace-nowrap");
    }
    expect(html.match(/<span class="truncate">30 h<\/span>/g)).toHaveLength(2);
  });

  it("fills in primary, link blue in dark, without a tone", () => {
    const html = renderToStaticMarkup(<MiniProgress value={50} />);

    expect(readRoot(html)).toContain('data-tone="default"');
    expect(readIndicator(html)).toContain('class="absolute inset-y-0 left-0 transition-[width] bg-primary dark:bg-link"');
  });

  it.each([
    { tone: "success", fill: "bg-green" },
    { tone: "warning", fill: "bg-orange" },
    { tone: "danger", fill: "bg-red" },
    { tone: "muted", fill: "bg-gray" },
    { tone: "default", fill: "bg-gray" },
  ] as const)("fills in the $tone tone's colour", ({ tone, fill }) => {
    const html = renderToStaticMarkup(<MiniProgress value={50} tone={tone} />);

    expect(readRoot(html)).toContain(`data-tone="${tone}"`);
    expect(readIndicator(html)).toContain(`class="absolute inset-y-0 left-0 transition-[width] ${fill}"`);
  });

  it("is a 20 px rounded track that takes the cell's width, and merges the caller's classes and props", () => {
    const html = renderToStaticMarkup(<MiniProgress value={10} className="max-w-40" id="cost" />);
    const root = readRoot(html);

    expect(root).toContain('class="relative h-5 w-full min-w-16 overflow-hidden rounded-sm bg-primary/12 max-w-40"');
    expect(root).toContain('id="cost"');
  });
});
