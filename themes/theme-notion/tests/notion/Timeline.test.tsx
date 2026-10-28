// @vitest-environment happy-dom
import { cleanup, fireEvent, render } from "@testing-library/react";
import { Plane } from "lucide-react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import * as theme from "../../src/index.js";
import { Timeline, type TimelineItem } from "../../src/notion/Timeline.js";

afterEach(cleanup);

function readSlot(html: string, slot: string): string[] {
  return [...html.matchAll(new RegExp(`data-slot="${slot}"[^>]*class="([^"]*)"`, "g"))].map((match) => match[1] ?? "");
}

describe("Timeline", () => {
  it("is exported from the package root", () => {
    expect(theme.Timeline).toBe(Timeline);
  });

  it("renders one plain entry as a labelled ordered list with a marker, a hidden rail and the title", () => {
    expect(renderToStaticMarkup(<Timeline label="Trip" items={[{ key: "only", title: "Only" }]} />)).toBe(
      '<ol aria-label="Trip" data-slot="timeline" class="flex flex-col">' +
        '<li data-slot="timeline-item" data-item="only" data-size="default" data-line="solid" class="group/timeline-item relative grid grid-cols-[1.5rem_minmax(0,1fr)_auto] gap-x-1 pb-2">' +
        '<span aria-hidden="true" data-slot="timeline-rail" class="absolute top-0 bottom-0 left-3 -translate-x-1/2 border-l-2 border-border group-first/timeline-item:top-4 group-last/timeline-item:bottom-auto group-last/timeline-item:h-4 group-only/timeline-item:hidden border-solid"></span>' +
        '<span aria-hidden="true" data-slot="timeline-marker" data-color="gray" class="relative mt-1 flex size-6 items-center justify-center justify-self-center rounded-full [&amp;&gt;svg]:size-3.5 bg-gray-tag text-gray-tag-foreground">' +
        '<span class="rounded-full size-2 bg-current"></span></span>' +
        '<div class="flex min-w-0 flex-col col-span-2"><div data-slot="timeline-item-body" class="flex min-w-0 flex-col gap-0.5 rounded-md px-2 py-1 text-start">' +
        '<span data-slot="timeline-item-title" class="text-ui-medium [overflow-wrap:anywhere]">Only</span></div></div></li></ol>',
    );
  });

  it("keeps the entries in the given order with their keys", () => {
    const html = renderToStaticMarkup(
      <Timeline
        label="Trip"
        items={[
          { key: "a", title: "A" },
          { key: "b", title: "B" },
          { key: "c", title: "C" },
        ]}
      />,
    );

    expect([...html.matchAll(/data-item="([a-z])"/g)].map((match) => match[1])).toEqual(["a", "b", "c"]);
  });

  it("draws the time above the title in a default entry and after it in a compact one", () => {
    const html = renderToStaticMarkup(
      <Timeline
        label="Trip"
        items={[
          { key: "stay", title: "Hanoi", time: "8–9 Dec" },
          { key: "move", title: "Train", time: "22:00", size: "compact" },
        ]}
      />,
    );

    expect(html.indexOf("8–9 Dec")).toBeLessThan(html.indexOf("Hanoi"));
    expect(html.indexOf("Train")).toBeLessThan(html.indexOf("22:00"));
    expect(readSlot(html, "timeline-item-time")).toEqual(["text-small text-muted-foreground tabular-nums", "text-small text-muted-foreground tabular-nums"]);
  });

  it("fills a default marker with its colour's tag and writes a compact one in its colour on the page", () => {
    const html = renderToStaticMarkup(
      <Timeline
        label="Trip"
        items={[
          { key: "stay", title: "Hanoi", color: "green", icon: Plane },
          { key: "move", title: "Train", color: "blue", size: "compact", icon: Plane },
          { key: "dot", title: "Walk", color: "red", size: "compact" },
        ]}
      />,
    );
    const markers = readSlot(html, "timeline-marker");

    expect(markers[0]).toContain("size-6");
    expect(markers[0]).toContain("bg-green-tag text-green-tag-foreground");
    expect(markers[1]).toContain("size-5");
    expect(markers[1]).toContain("bg-background");
    expect(markers[1]).toContain("text-blue");
    expect(html).toContain('<span class="rounded-full size-2 bg-red"></span>');
    expect(html.match(/<svg/g)).toHaveLength(2);
  });

  it("dashes the rail through an entry with a dashed line", () => {
    const html = renderToStaticMarkup(<Timeline label="Trip" items={[{ key: "gap", title: "Gap", line: "dashed" }]} />);

    expect(html).toContain('data-line="dashed"');
    expect(readSlot(html, "timeline-rail")[0]).toMatch(/ border-dashed$/);
  });

  it("draws the description, the badges and the content under the title", () => {
    const html = renderToStaticMarkup(
      <Timeline
        label="Trip"
        items={[
          {
            key: "stay",
            title: "Hanoi",
            description: "Old Quarter",
            badges: <em>Booked</em>,
            children: <p>Pay by 1 Dec</p>,
          },
        ]}
      />,
    );

    expect(readSlot(html, "timeline-item-description")).toEqual(["text-small text-muted-foreground [overflow-wrap:anywhere]"]);
    expect(readSlot(html, "timeline-item-badges")).toEqual(["mt-1 flex flex-wrap items-center gap-x-3 gap-y-1"]);
    expect(html).toContain('<div data-slot="timeline-item-content" class="px-2 pb-1"><p>Pay by 1 Dec</p></div>');
  });

  it("makes the body a button named by its action and its text that calls onSelect, with the aside beside it and not inside", () => {
    const onSelect = vi.fn();
    const items: readonly TimelineItem[] = [
      { key: "stay", title: "Hanoi", time: "8 Dec", onSelect, actionLabel: "Show on the map", aside: <button type="button">1 warning</button> },
    ];
    const { getByRole } = render(<Timeline label="Trip" items={items} />);
    const body = getByRole("button", { name: /^Show on the map: 8 Dec ?Hanoi$/ });

    fireEvent.click(body);

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(body.getAttribute("data-slot")).toBe("timeline-item-body");
    expect(body.querySelector("button")).toBeNull();
    expect(getByRole("button", { name: "1 warning" }).closest('[data-slot="timeline-item-aside"]')).not.toBeNull();
  });

  it("leaves the body a plain block without onSelect and spans it over the aside's column", () => {
    const html = renderToStaticMarkup(<Timeline label="Trip" items={[{ key: "stay", title: "Hanoi" }]} />);

    expect(html).not.toContain("<button");
    expect(html).toContain('class="flex min-w-0 flex-col col-span-2"');
  });

  it("reads no action before a button without actionLabel", () => {
    const html = renderToStaticMarkup(<Timeline label="Trip" items={[{ key: "stay", title: "Hanoi", onSelect: () => undefined }]} />);

    expect(html).toContain("<button");
    expect(html).not.toContain("sr-only");
  });

  it("sets the app's data attributes on the item", () => {
    const html = renderToStaticMarkup(<Timeline label="Trip" items={[{ key: "stay", title: "Hanoi", data: { "data-kind": "covered", "data-status": undefined } }]} />);

    expect(html).toContain('<li data-kind="covered" data-slot="timeline-item"');
    expect(html).not.toContain("data-status");
  });

  it("adds the app's classes to the list", () => {
    expect(renderToStaticMarkup(<Timeline label="Trip" items={[]} className="pb-4" />)).toBe('<ol aria-label="Trip" data-slot="timeline" class="flex flex-col pb-4"></ol>');
  });
});
