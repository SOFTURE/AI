import { BedDouble, TrainFront } from "lucide-react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import * as theme from "../../src/index.js";
import { PALETTE_COLORS } from "../../src/notion/palette.js";
import { Timeline, type TimelineItem } from "../../src/notion/Timeline.js";

const RAIL_BASE = "absolute left-3 w-0 -translate-x-1/2 border-l border-accent-strong";

function render(items: readonly TimelineItem[]): string {
  return renderToStaticMarkup(<Timeline label="Trip" items={items} />);
}

function readRails(html: string): string[] {
  return [...html.matchAll(/data-slot="timeline-rail" class="([^"]+)"/g)].map((match) => match[1] ?? "");
}

function readSlots(html: string): string[] {
  return [...html.matchAll(/data-slot="(timeline[a-z-]*)"/g)].map((match) => match[1] ?? "");
}

describe("Timeline", () => {
  it("renders one entry as a labelled ordered list with no rail", () => {
    expect(render([{ key: "only", title: "Lisbon" }])).toBe(
      '<ol aria-label="Trip" data-slot="timeline" class="flex flex-col">' +
        '<li data-slot="timeline-item" data-size="default" data-color="gray" data-line="solid" class="relative flex min-w-0 items-start gap-1 pb-2 last:pb-0">' +
        '<span aria-hidden="true" data-slot="timeline-marker" class="relative mt-1 flex size-6 shrink-0 items-center justify-center">' +
        '<span class="flex size-6 items-center justify-center rounded-full bg-gray-tag text-gray-tag-foreground"></span></span>' +
        '<div class="flex min-w-0 flex-1 flex-col">' +
        '<div data-slot="timeline-body" class="flex w-full min-w-0 flex-col items-start gap-0.5 rounded-md px-2 py-1 text-left">' +
        '<span data-slot="timeline-title" class="text-ui-medium">Lisbon</span></div></div></li></ol>',
    );
  });

  it("draws every part in order: rail, marker, time, title, description, badges, content, aside", () => {
    const html = render([
      {
        key: "stay",
        time: "3–6 Dec",
        title: "Lisbon",
        description: "3 nights",
        badges: <em>booked</em>,
        aside: <strong>2</strong>,
        children: <p>Pay by 1 Dec</p>,
      },
      { key: "next", title: "Porto" },
    ]);

    expect(readSlots(html).slice(0, 10)).toEqual([
      "timeline",
      "timeline-item",
      "timeline-rail",
      "timeline-marker",
      "timeline-body",
      "timeline-time",
      "timeline-title",
      "timeline-description",
      "timeline-badges",
      "timeline-content",
    ]);
    expect(readSlots(html)[10]).toBe("timeline-aside");
    expect(html).toContain('<span data-slot="timeline-time" class="text-small text-muted-foreground tabular-nums">3–6 Dec</span>');
    expect(html).toContain('<span data-slot="timeline-description" class="text-small text-muted-foreground">3 nights</span>');
    expect(html).toContain('<span data-slot="timeline-badges" class="mt-0.5 flex flex-wrap gap-1"><em>booked</em></span>');
    expect(html).toContain('<div data-slot="timeline-content" class="px-2 pt-1 text-small"><p>Pay by 1 Dec</p></div>');
    expect(html).toContain('<div data-slot="timeline-aside" class="flex shrink-0 items-center gap-1 pt-1"><strong>2</strong></div>');
  });

  it("leaves out the optional parts when absent", () => {
    const html = render([{ key: "a", title: "A" }]);

    for (const slot of ["timeline-time", "timeline-description", "timeline-badges", "timeline-content", "timeline-aside"]) {
      expect(html).not.toContain(`data-slot="${slot}"`);
    }
  });

  it("runs the rail from the first marker's centre to the last marker's centre", () => {
    const rails = readRails(render([{ key: "a", title: "A" }, { key: "b", title: "B" }, { key: "c", title: "C" }]));

    expect(rails).toEqual([
      `${RAIL_BASE} border-solid top-4 bottom-0`,
      `${RAIL_BASE} border-solid top-0 bottom-0`,
      `${RAIL_BASE} border-solid top-0 h-4`,
    ]);
  });

  it("measures the rail's ends from a compact marker's centre", () => {
    const rails = readRails(render([{ key: "a", title: "A", size: "compact" }, { key: "b", title: "B", size: "compact" }]));

    expect(rails).toEqual([`${RAIL_BASE} border-solid top-3 bottom-0`, `${RAIL_BASE} border-solid top-0 h-3`]);
  });

  it("dashes the rail through a gap entry only", () => {
    const html = render([{ key: "a", title: "A" }, { key: "gap", title: "No stay", line: "dashed" }, { key: "c", title: "C" }]);

    expect(readRails(html)).toEqual([
      `${RAIL_BASE} border-solid top-4 bottom-0`,
      `${RAIL_BASE} border-dashed top-0 bottom-0`,
      `${RAIL_BASE} border-solid top-0 h-4`,
    ]);
    expect(html).toContain('data-slot="timeline-item" data-size="default" data-color="gray" data-line="dashed"');
  });

  it("fills a default marker with each palette colour's tag pair and draws its icon", () => {
    for (const color of PALETTE_COLORS) {
      const html = render([{ key: "a", title: "A", color, icon: BedDouble }]);

      expect(html).toContain(`data-color="${color}"`);
      expect(html).toContain(`<span class="flex size-6 items-center justify-center rounded-full bg-${color}-tag text-${color}-tag-foreground"><svg`);
      expect(html).toMatch(/<svg[^>]*stroke-width="1.75"[^>]*class="lucide lucide-bed-double size-3.5"/);
    }
  });

  it("draws a compact entry as a coloured icon or a dot on the page background, with tighter text", () => {
    const withIcon = render([{ key: "move", title: "Train", size: "compact", color: "blue", icon: TrainFront }]);
    const withDot = render([{ key: "note", title: "Check-in", size: "compact", color: "orange" }]);

    expect(withIcon).toContain('class="relative mt-0.5 flex h-5 w-6 shrink-0 items-center justify-center"');
    expect(withIcon).toContain('<span class="flex size-5 items-center justify-center rounded-full bg-background"><svg');
    expect(withIcon).toMatch(/class="lucide lucide-train-front size-4 text-blue"/);
    expect(withIcon).toContain('class="relative flex min-w-0 items-start gap-1 pb-1 last:pb-0"');
    expect(withIcon).toContain('class="flex w-full min-w-0 flex-col items-start gap-0 rounded-md px-2 py-0.5 text-left"');
    expect(withIcon).toContain('<span data-slot="timeline-title" class="text-small">Train</span>');
    expect(withDot).toContain(
      '<span class="flex size-4 items-center justify-center rounded-full bg-background"><span class="size-2 rounded-full bg-orange"></span></span>',
    );
  });

  it("hides the marker and the rail from assistive technology", () => {
    const html = render([{ key: "a", title: "A" }, { key: "b", title: "B" }]);

    expect(html.match(/aria-hidden="true" data-slot="timeline-marker"/g)).toHaveLength(2);
    expect(html.match(/aria-hidden="true" data-slot="timeline-rail"/g)).toHaveLength(2);
  });

  it("turns the body into a named button when the entry is selectable", () => {
    const html = render([{ key: "a", title: "Lisbon", onSelect: () => undefined, actionLabel: "Open the Lisbon stay" }]);

    expect(html).toContain(
      '<button type="button" data-slot="timeline-body" aria-label="Open the Lisbon stay" class="flex w-full min-w-0 flex-col items-start gap-0.5 rounded-md px-2 py-1 text-left cursor-pointer transition-colors duration-120 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">',
    );
    expect(html).not.toContain('<div data-slot="timeline-body"');
  });

  it("keeps the content and the aside outside the body's button", () => {
    const html = render([
      {
        key: "a",
        title: "Lisbon",
        onSelect: () => undefined,
        actionLabel: "Open",
        aside: <button type="button">Marks</button>,
        children: <a href="#pay">Pay</a>,
      },
    ]);
    const body = /<button type="button" data-slot="timeline-body"[^>]*>(.*?)<\/button>/.exec(html)?.[1] ?? "";

    expect(body).toBe('<span data-slot="timeline-title" class="text-ui-medium">Lisbon</span>');
    expect(html).toContain('<div data-slot="timeline-aside" class="flex shrink-0 items-center gap-1 pt-1"><button type="button">Marks</button></div>');
    expect(html).toContain('<div data-slot="timeline-content" class="px-2 pt-1 text-small"><a href="#pay">Pay</a></div>');
  });

  it("passes the entry's data attributes without letting them replace its own", () => {
    const html = render([{ key: "a", title: "A", data: { "data-stay": "s1", "data-slot": "mine", "data-kind": undefined } }]);

    expect(html).toContain('<li data-stay="s1" data-slot="timeline-item"');
    expect(html).not.toContain("data-kind");
    expect(html).not.toContain('data-slot="mine"');
  });

  it("renders an empty list when there are no entries", () => {
    expect(render([])).toBe('<ol aria-label="Trip" data-slot="timeline" class="flex flex-col"></ol>');
  });

  it("is exported from the package root", () => {
    expect(theme.Timeline).toBe(Timeline);
  });
});

