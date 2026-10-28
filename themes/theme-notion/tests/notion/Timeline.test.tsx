import { BedDouble, TrainFront } from "lucide-react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import * as theme from "../../src/index.js";
import { PALETTE_COLORS } from "../../src/notion/palette.js";
import { Timeline, type TimelineItem } from "../../src/notion/Timeline.js";

const ITEM = "group/timeline-item relative grid grid-cols-[1.5rem_minmax(0,1fr)_auto] gap-x-1";
const RAIL =
  "absolute top-0 bottom-0 left-3 -translate-x-1/2 border-l-2 border-border group-first/timeline-item:top-4 group-last/timeline-item:bottom-auto group-last/timeline-item:h-4 group-only/timeline-item:hidden";
// As rendered: the markup escapes `&>` in the arbitrary variant.
const MARKER_DEFAULT = "relative mt-1 flex size-6 items-center justify-center justify-self-center rounded-full [&amp;&gt;svg]:size-3.5";
const MARKER_COMPACT =
  "relative mt-1.5 flex size-5 items-center justify-center justify-self-center rounded-full bg-background [&amp;&gt;svg]:size-3.5";
const BODY_DEFAULT = "flex min-w-0 flex-col gap-0.5 rounded-md px-2 py-1 text-start";
const BODY_BUTTON =
  "cursor-pointer text-foreground transition-colors duration-120 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";
const TITLE = '<span data-slot="timeline-item-title" class="text-ui-medium [overflow-wrap:anywhere]">';
const TIME = '<span data-slot="timeline-item-time" class="text-small text-muted-foreground tabular-nums">';

function render(items: readonly TimelineItem[]): string {
  return renderToStaticMarkup(<Timeline label="Trip" items={items} />);
}

function readSlots(html: string): string[] {
  return [...html.matchAll(/data-slot="(timeline[a-z-]*)"/g)].map((match) => match[1] ?? "");
}

describe("Timeline", () => {
  it("renders one entry as a labelled ordered list with a rail, a gray dot marker and a plain body", () => {
    expect(render([{ key: "only", title: "Lisbon" }])).toBe(
      '<ol aria-label="Trip" data-slot="timeline" class="flex flex-col">' +
        `<li data-slot="timeline-item" data-item="only" data-size="default" data-line="solid" class="${ITEM} pb-2">` +
        `<span aria-hidden="true" data-slot="timeline-rail" class="${RAIL} border-solid"></span>` +
        `<span aria-hidden="true" data-slot="timeline-marker" data-color="gray" class="${MARKER_DEFAULT} bg-gray-tag text-gray-tag-foreground">` +
        '<span class="rounded-full size-2 bg-current"></span></span>' +
        '<div class="flex min-w-0 flex-col col-span-2">' +
        `<div data-slot="timeline-item-body" class="${BODY_DEFAULT}">${TITLE}Lisbon</span></div></div></li></ol>`,
    );
  });

  it("adds the app's className to the list", () => {
    expect(renderToStaticMarkup(<Timeline label="Trip" items={[]} className="max-w-md" />)).toBe(
      '<ol aria-label="Trip" data-slot="timeline" class="flex flex-col max-w-md"></ol>',
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
    ]);

    expect(readSlots(html)).toEqual([
      "timeline",
      "timeline-item",
      "timeline-rail",
      "timeline-marker",
      "timeline-item-body",
      "timeline-item-time",
      "timeline-item-title",
      "timeline-item-description",
      "timeline-item-badges",
      "timeline-item-content",
      "timeline-item-aside",
    ]);
    expect(html).toContain(`${TIME}3–6 Dec</span>${TITLE}Lisbon</span>`);
    expect(html).toContain(
      '<span data-slot="timeline-item-description" class="text-small text-muted-foreground [overflow-wrap:anywhere]">3 nights</span>',
    );
    expect(html).toContain('<span data-slot="timeline-item-badges" class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1"><em>booked</em></span>');
    expect(html).toContain('<div data-slot="timeline-item-content" class="px-2 pb-1"><p>Pay by 1 Dec</p></div>');
    expect(html).toContain('<div data-slot="timeline-item-aside" class="flex shrink-0 items-start gap-1 pt-1"><strong>2</strong></div>');
    // With an aside, the body leaves the third column to it.
    expect(html).toContain('<div class="flex min-w-0 flex-col">');
  });

  it("leaves out the optional parts when absent", () => {
    const html = render([{ key: "a", title: "A" }]);

    for (const slot of ["time", "description", "badges", "content", "aside"]) {
      expect(html).not.toContain(`data-slot="timeline-item-${slot}"`);
    }
  });

  it("gives every entry one rail segment that the first, last and only entry trim by position", () => {
    const html = render([{ key: "a", title: "A" }, { key: "b", title: "B", size: "compact" }, { key: "c", title: "C" }]);

    expect(html.match(/data-slot="timeline-rail"/g)).toHaveLength(3);
    expect(RAIL).toContain("group-first/timeline-item:top-4");
    expect(RAIL).toContain("group-last/timeline-item:h-4");
    expect(RAIL).toContain("group-only/timeline-item:hidden");
  });

  it("dashes the rail through a gap entry only", () => {
    const html = render([{ key: "a", title: "A" }, { key: "gap", title: "No stay", line: "dashed" }]);

    expect(html).toContain(`data-item="a" data-size="default" data-line="solid"`);
    expect(html).toContain(`data-item="gap" data-size="default" data-line="dashed"`);
    expect(html.match(/class="[^"]*border-dashed"/g)).toHaveLength(1);
  });

  it("fills a default marker with each palette colour's tag pair and draws its icon", () => {
    for (const color of PALETTE_COLORS) {
      const html = render([{ key: "a", title: "A", color, icon: BedDouble }]);

      expect(html).toContain(
        `data-slot="timeline-marker" data-color="${color}" class="${MARKER_DEFAULT} bg-${color}-tag text-${color}-tag-foreground"><svg`,
      );
      expect(html).toMatch(/<svg[^>]*stroke-width="1.75"[^>]*class="lucide lucide-bed-double"/);
    }
  });

  it("draws a compact marker as a coloured icon or dot on the page background, with the time beside the title", () => {
    const withIcon = render([{ key: "move", time: "09:12", title: "Train", size: "compact", color: "blue", icon: TrainFront }]);
    const withDot = render([{ key: "note", title: "Check-in", size: "compact", color: "orange" }]);

    expect(withIcon).toContain(`data-color="blue" class="${MARKER_COMPACT} text-blue"><svg`);
    expect(withIcon).toContain(`data-size="compact" data-line="solid" class="${ITEM} pb-1"`);
    expect(withIcon).toContain(
      `<div data-slot="timeline-item-body" class="flex min-w-0 flex-col rounded-md px-2 py-1 text-start"><span class="flex flex-wrap items-baseline gap-x-2">${TITLE}Train</span>${TIME}09:12</span></span>`,
    );
    expect(withDot).toContain(`data-color="orange" class="${MARKER_COMPACT} text-orange"><span class="rounded-full size-2 bg-orange"></span>`);
  });

  it("hides the marker and the rail from assistive technology", () => {
    const html = render([{ key: "a", title: "A" }, { key: "b", title: "B" }]);

    expect(html.match(/aria-hidden="true" data-slot="timeline-marker"/g)).toHaveLength(2);
    expect(html.match(/aria-hidden="true" data-slot="timeline-rail"/g)).toHaveLength(2);
  });

  it("turns the body into a button whose name starts with the action, then the visible words", () => {
    const html = render([{ key: "a", title: "Lisbon", onSelect: () => undefined, actionLabel: "Show on the map" }]);

    expect(html).toContain(
      `<button type="button" data-slot="timeline-item-body" class="${BODY_DEFAULT} ${BODY_BUTTON}">` +
        `<span class="sr-only">Show on the map: </span>${TITLE}Lisbon</span></button>`,
    );
    expect(html).not.toContain("aria-label=\"Show");
    expect(html).not.toContain('<div data-slot="timeline-item-body"');
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
    const body = /<button type="button" data-slot="timeline-item-body"[^>]*>(.*?)<\/button>/.exec(html)?.[1] ?? "";

    expect(body).toBe(`<span class="sr-only">Open: </span>${TITLE}Lisbon</span>`);
    expect(html).toContain('<div data-slot="timeline-item-aside" class="flex shrink-0 items-start gap-1 pt-1"><button type="button">Marks</button></div>');
    expect(html).toContain('<div data-slot="timeline-item-content" class="px-2 pb-1"><a href="#pay">Pay</a></div>');
  });

  it("passes the entry's data attributes without letting them replace its own", () => {
    const html = render([{ key: "a", title: "A", data: { "data-stay": "s1", "data-slot": "mine", "data-item": "x", "data-kind": undefined } }]);

    expect(html).toContain('<li data-stay="s1" data-slot="timeline-item" data-item="a"');
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
