// @vitest-environment happy-dom
// Issue #409: the event axis, its layout and its keyboard and pointer readout. Oracles are written by hand.
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { chartsMessages, EventAxis, type EventAxisItem, layoutEventAxis } from "../src/index.js";

afterEach(() => {
  cleanup();
});

const ITEMS: EventAxisItem[] = [
  { kind: "span", key: "school", label: "School", detail: "2026–2030", startPercent: 0, endPercent: 40, slot: 2 },
  { kind: "milestone", key: "unlock", label: "Funds unlock", xPercent: 60, tone: "accent" },
  { kind: "span", key: "job", label: "First job", startPercent: 30, endPercent: 70, color: "var(--app-job)" },
  { kind: "span", key: "trip", label: "Trip", startPercent: 40, endPercent: 50 },
];

describe("layoutEventAxis", () => {
  it("puts milestones on the top row and packs spans below, a span starting at another's end sharing its row", () => {
    const { entries, lanes } = layoutEventAxis(ITEMS);
    expect(lanes).toBe(3);
    expect(entries.map((entry) => [entry.item.key, entry.lane, entry.index])).toEqual([
      ["school", 1, 0],
      ["job", 2, 2],
      ["trip", 1, 3],
      ["unlock", 0, 1],
    ]);
  });

  it("clamps positions to the axis and orders a span's ends", () => {
    const { entries, lanes } = layoutEventAxis([{ kind: "span", key: "a", label: "A", startPercent: 120, endPercent: -5 }]);
    expect(lanes).toBe(1);
    expect(entries[0]).toMatchObject({ lane: 0, startPercent: 0, endPercent: 100 });
  });

  it("needs no row for no items", () => {
    expect(layoutEventAxis([])).toEqual({ entries: [], lanes: 0 });
  });
});

function renderAxis(props: Partial<Parameters<typeof EventAxis>[0]> = {}) {
  const view = render(<EventAxis title="Life events" items={ITEMS} {...props} />);
  return { view, group: screen.getByRole("group"), status: screen.getByRole("status") };
}

describe("EventAxis", () => {
  it("is a focusable group named from messages, in the app's translation too", () => {
    const { group } = renderAxis();
    expect(group.getAttribute("tabindex")).toBe("0");
    expect(group.getAttribute("aria-label")).toBe(chartsMessages.en.eventAxis.label.replace("{title}", "Life events"));
    cleanup();
    const translated = renderAxis({ locale: "de", messages: { eventAxis: { label: "{title}. Pfeiltasten wechseln das Ereignis." } } });
    expect(translated.group.getAttribute("aria-label")).toBe("Life events. Pfeiltasten wechseln das Ereignis.");
  });

  it("draws spans as labelled bars and milestones as dots, on their rows and in their colours", () => {
    const { view } = renderAxis();
    const track = view.container.querySelector(".sft-chart-event-track");
    expect(track?.getAttribute("aria-hidden")).toBe("true");
    expect(track?.getAttribute("style")).toBe("--sft-chart-event-lanes: 3;");
    const school = view.container.querySelector('[data-key="school"]');
    expect(school?.className).toBe("sft-chart-event sft-chart-event-span sft-chart-series-2");
    expect(school?.getAttribute("style")).toBe("--sft-chart-event-lane: 1; left: 0%; width: 40%;");
    expect(school?.textContent).toBe("School");
    const unlock = view.container.querySelector('[data-key="unlock"]');
    expect(unlock?.className).toBe("sft-chart-event sft-chart-event-milestone sft-chart-tone-accent sft-chart-fill-tone");
    expect(unlock?.getAttribute("style")).toBe("--sft-chart-event-lane: 0; left: 60%;");
    expect(unlock?.textContent).toBe("");
    expect(view.container.querySelector('[data-key="job"]')?.getAttribute("style")).toBe("--sft-chart-event-lane: 2; left: 30%; width: 40%; --sft-chart-series: var(--app-job);");
  });

  it("steps through the items by start with the arrows, Home and End, and clears on Escape", () => {
    const { group, status, view } = renderAxis();
    expect(status.textContent).toBe("");
    fireEvent.keyDown(group, { key: "ArrowRight" });
    expect(status.textContent).toBe("School 2026–2030");
    expect(view.container.querySelector('[data-key="school"]')?.classList.contains("sft-chart-event-active")).toBe(true);
    fireEvent.keyDown(group, { key: "ArrowRight" });
    expect(status.textContent).toBe("First job");
    fireEvent.keyDown(group, { key: "End" });
    expect(status.textContent).toBe("Funds unlock");
    fireEvent.keyDown(group, { key: "ArrowRight" });
    expect(status.textContent).toBe("Funds unlock");
    fireEvent.keyDown(group, { key: "Home" });
    expect(status.textContent).toBe("School 2026–2030");
    fireEvent.keyDown(group, { key: "Escape" });
    expect(status.textContent).toBe("");
  });

  it("activates the item under the pointer and clears when the pointer leaves", () => {
    const onActiveChange = vi.fn();
    const { group, status, view } = renderAxis({ onActiveChange });
    const trip = view.container.querySelector('[data-key="trip"]');
    if (!trip) throw new Error("trip not rendered");
    fireEvent.pointerEnter(trip);
    expect(status.textContent).toBe("Trip");
    fireEvent.pointerDown(trip);
    fireEvent.pointerLeave(group);
    expect(status.textContent).toBe("");
    expect(onActiveChange.mock.calls).toEqual([[3], [null]]);
  });

  it("renders the app's readout with the item and its index in the input", () => {
    const { group, status } = renderAxis({ renderReadout: (item, index) => `${item.label} #${String(index)}` });
    fireEvent.keyDown(group, { key: "ArrowLeft" });
    expect(status.textContent).toBe("Funds unlock #1");
  });
});
