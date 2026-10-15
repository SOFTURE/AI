// @vitest-environment happy-dom
// Issue #508: the event axis on one rail, its layout and its keyboard and pointer readout. Oracles are written by hand.
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EventAxis, type EventAxisMilestone, type EventAxisRailProps, layoutEventRail } from "../src/index.js";

afterEach(() => {
  cleanup();
});

const MILESTONES: EventAxisMilestone[] = [
  { kind: "milestone", key: "deadline", label: "Deadline", detail: "2050", xPercent: 90, tone: "danger", railTone: "success", segmentLabel: "20 years", tick: "2050" },
  { kind: "milestone", key: "today", label: "Today", xPercent: 0, tick: "2026" },
  { kind: "milestone", key: "goal", label: "Goal", xPercent: 45, slot: 3, segmentLabel: "15 years 8 mo.", tick: "2041" },
  { kind: "milestone", key: "trip", label: "Trip", xPercent: 48, railColor: "var(--app-trip)", segmentLabel: "3 mo.", tick: "2042" },
];

describe("layoutEventRail", () => {
  it("orders milestones by x and gives each but the first the segment from the previous one", () => {
    const { entries } = layoutEventRail(MILESTONES);
    expect(entries.map((entry) => [entry.item.key, entry.index, entry.xPercent, entry.segment])).toEqual([
      ["today", 1, 0, null],
      ["goal", 2, 45, { startPercent: 0, endPercent: 45, isLabelShown: true }],
      ["trip", 3, 48, { startPercent: 45, endPercent: 48, isLabelShown: true }],
      ["deadline", 0, 90, { startPercent: 48, endPercent: 90, isLabelShown: true }],
    ]);
  });

  it("hides a segment label narrower than minLabelWidth and keeps one exactly as wide", () => {
    const { entries } = layoutEventRail(MILESTONES, { minLabelWidth: 42 });
    expect(entries.map((entry) => entry.segment?.isLabelShown ?? null)).toEqual([null, true, false, true]);
  });

  it("shows no label for a segment without one, and has no segment between milestones at the same x", () => {
    const { entries } = layoutEventRail([
      { kind: "milestone", key: "a", label: "A", xPercent: 10 },
      { kind: "milestone", key: "b", label: "B", xPercent: 30 },
      { kind: "milestone", key: "c", label: "C", xPercent: 30, segmentLabel: "none" },
    ]);
    expect(entries.map((entry) => entry.segment)).toEqual([null, { startPercent: 10, endPercent: 30, isLabelShown: false }, null]);
  });

  it("clamps positions to the axis", () => {
    const { entries } = layoutEventRail([
      { kind: "milestone", key: "a", label: "A", xPercent: -20 },
      { kind: "milestone", key: "b", label: "B", xPercent: 140 },
    ]);
    expect(entries.map((entry) => [entry.xPercent, entry.segment])).toEqual([
      [0, null],
      [100, { startPercent: 0, endPercent: 100, isLabelShown: false }],
    ]);
  });

  it("needs no entry for no milestones", () => {
    expect(layoutEventRail([])).toEqual({ entries: [] });
  });
});

function renderRail(props: Partial<EventAxisRailProps> = {}) {
  const view = render(<EventAxis layout="rail" title="Plan" items={MILESTONES} minLabelWidth={5} {...props} />);
  return { view, group: screen.getByRole("group"), status: screen.getByRole("status") };
}

function getPart(container: HTMLElement, key: string, part: "segment" | "dot" | "tick"): Element {
  const selector = part === "dot" ? `.sft-chart-event-milestone[data-key="${key}"]` : `.sft-chart-event-${part}[data-key="${key}"]`;
  const element = container.querySelector(selector);
  if (!element) throw new Error(`${part} of ${key} not rendered`);
  return element;
}

describe("EventAxis rail", () => {
  it("draws one rail: segments, then dots, then ticks, with no lanes", () => {
    const { view } = renderRail();
    expect(view.container.firstElementChild?.className).toBe("sft-chart-event-axis sft-chart-event-axis-rail");
    const track = view.container.querySelector(".sft-chart-event-track");
    expect(track?.className).toBe("sft-chart-event-track sft-chart-event-rail");
    expect(track?.getAttribute("aria-hidden")).toBe("true");
    expect(track?.getAttribute("style")).toBeNull();
    expect([...(track?.children ?? [])].map((child) => `${child.className.split(" ")[0] ?? ""}:${child.getAttribute("data-key") ?? ""}`)).toEqual([
      "sft-chart-event-segment:goal",
      "sft-chart-event-segment:trip",
      "sft-chart-event-segment:deadline",
      "sft-chart-event:today",
      "sft-chart-event:goal",
      "sft-chart-event:trip",
      "sft-chart-event:deadline",
      "sft-chart-event-tick:today",
      "sft-chart-event-tick:goal",
      "sft-chart-event-tick:trip",
      "sft-chart-event-tick:deadline",
    ]);
  });

  it("colours a segment apart from the dot it leads to, else in the dot's colour", () => {
    const { view } = renderRail();
    const deadlineSegment = getPart(view.container, "deadline", "segment");
    expect(deadlineSegment.className).toBe("sft-chart-event-segment sft-chart-tone-success sft-chart-fill-tone");
    expect(deadlineSegment.getAttribute("style")).toBe("left: 48%; width: 42%;");
    expect(deadlineSegment.textContent).toBe("20 years");
    const deadlineDot = getPart(view.container, "deadline", "dot");
    expect(deadlineDot.className).toBe("sft-chart-event sft-chart-event-milestone sft-chart-tone-danger sft-chart-fill-tone");
    expect(deadlineDot.getAttribute("style")).toBe("left: 90%;");
    expect(deadlineDot.textContent).toBe("");
    expect(getPart(view.container, "goal", "segment").className).toBe("sft-chart-event-segment sft-chart-series-3");
    const tripSegment = getPart(view.container, "trip", "segment");
    expect(tripSegment.className).toBe("sft-chart-event-segment");
    expect(tripSegment.getAttribute("style")).toBe("left: 45%; width: 3%; --sft-chart-series: var(--app-trip);");
    expect(tripSegment.textContent).toBe("");
  });

  it("takes the rail colour over the rail slot over the rail tone", () => {
    const { view } = renderRail({
      items: [
        { kind: "milestone", key: "a", label: "A", xPercent: 0 },
        { kind: "milestone", key: "b", label: "B", xPercent: 50, railSlot: 2, railTone: "danger", railColor: "var(--app-b)" },
        { kind: "milestone", key: "c", label: "C", xPercent: 100, railSlot: 4, railTone: "danger", tone: "accent" },
      ],
    });
    const b = getPart(view.container, "b", "segment");
    expect(b.className).toBe("sft-chart-event-segment sft-chart-series-2");
    expect(b.getAttribute("style")).toBe("left: 0%; width: 50%; --sft-chart-series: var(--app-b);");
    expect(getPart(view.container, "c", "segment").className).toBe("sft-chart-event-segment sft-chart-series-4");
  });

  it("writes each tick under its dot and leaves a milestone without one out", () => {
    const { view } = renderRail({ items: [...MILESTONES, { kind: "milestone", key: "plain", label: "Plain", xPercent: 100 }] });
    const tick = getPart(view.container, "goal", "tick");
    expect(tick.className).toBe("sft-chart-event-tick");
    expect(tick.getAttribute("style")).toBe("left: 45%;");
    expect(tick.textContent).toBe("2041");
    expect(view.container.querySelector('.sft-chart-event-tick[data-key="plain"]')).toBeNull();
  });

  it("steps through the milestones by x with the arrows, Home and End, and marks the active dot and segment", () => {
    const { group, status, view } = renderRail();
    fireEvent.keyDown(group, { key: "ArrowRight" });
    expect(status.textContent).toBe("Today");
    fireEvent.keyDown(group, { key: "ArrowRight" });
    expect(status.textContent).toBe("Goal");
    expect(getPart(view.container, "goal", "dot").classList.contains("sft-chart-event-active")).toBe(true);
    expect(getPart(view.container, "goal", "segment").classList.contains("sft-chart-event-active")).toBe(true);
    expect(getPart(view.container, "trip", "segment").classList.contains("sft-chart-event-active")).toBe(false);
    fireEvent.keyDown(group, { key: "End" });
    expect(status.textContent).toBe("Deadline 2050");
    fireEvent.keyDown(group, { key: "Home" });
    expect(status.textContent).toBe("Today");
    fireEvent.keyDown(group, { key: "Escape" });
    expect(status.textContent).toBe("");
  });

  it("activates a milestone from its dot or the segment leading to it, and clears when the pointer leaves", () => {
    const onActiveChange = vi.fn();
    const { group, status, view } = renderRail({ onActiveChange });
    fireEvent.pointerEnter(getPart(view.container, "deadline", "segment"));
    expect(status.textContent).toBe("Deadline 2050");
    fireEvent.pointerDown(getPart(view.container, "goal", "dot"));
    expect(status.textContent).toBe("Goal");
    fireEvent.pointerLeave(group);
    expect(status.textContent).toBe("");
    expect(onActiveChange.mock.calls).toEqual([[0], [2], [null]]);
  });

  it("renders the app's readout with the milestone and its index in the input", () => {
    const { group, status } = renderRail({ renderReadout: (item, index) => `${item.label} #${String(index)}` });
    fireEvent.keyDown(group, { key: "ArrowLeft" });
    expect(status.textContent).toBe("Deadline #0");
  });
});
