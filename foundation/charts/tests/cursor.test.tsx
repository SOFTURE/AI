// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type CursorPoint, ChartCursor, chartsMessages } from "../src/index.js";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const POINTS: CursorPoint[] = [
  { key: 0, xPercent: 0, heading: "Jan 2026", values: [{ key: "a", slot: 1, yPercent: 10, label: "Savings", value: "1,000" }] },
  { key: 1, xPercent: 50, heading: "Feb 2026", values: [{ key: "a", slot: 1, yPercent: 40, label: "Savings", value: "4,000" }] },
  { key: 2, xPercent: 100, heading: "Mar 2026", values: [{ key: "a", slot: 1, yPercent: 90, label: "Savings", value: "9,000" }] },
];

function renderCursor(points: readonly CursorPoint[] = POINTS, locale: "en" | "pl" = "en") {
  render(
    <ChartCursor title="Savings over time" points={points} locale={locale}>
      <div className="sft-chart-plot" />
    </ChartCursor>,
  );
  return { group: screen.getByRole("group"), status: screen.getByRole("status") };
}

describe("ChartCursor", () => {
  it("is a focusable group named from messages with the chart's title", () => {
    const { group } = renderCursor();
    expect(group.getAttribute("tabindex")).toBe("0");
    expect(group.getAttribute("aria-label")).toBe(chartsMessages.en.cursor.label.replace("{title}", "Savings over time"));
  });

  it("takes its name from the Polish dictionary in pl", () => {
    const { group } = renderCursor(POINTS, "pl");
    expect(group.getAttribute("aria-label")).toBe(chartsMessages.pl.cursor.label.replace("{title}", "Savings over time"));
  });

  it("starts empty, then the right arrow goes to the first point and on", () => {
    const { group, status } = renderCursor();
    expect(status.textContent).toBe("");
    fireEvent.keyDown(group, { key: "ArrowRight" });
    expect(status.textContent).toBe("Jan 2026 Savings 1,000");
    fireEvent.keyDown(group, { key: "ArrowRight" });
    expect(status.textContent).toBe("Feb 2026 Savings 4,000");
  });

  it("goes to the last point on a first left arrow and stops at both ends", () => {
    const { group, status } = renderCursor();
    fireEvent.keyDown(group, { key: "ArrowLeft" });
    expect(status.textContent).toContain("Mar 2026");
    fireEvent.keyDown(group, { key: "ArrowRight" });
    expect(status.textContent).toContain("Mar 2026");
    fireEvent.keyDown(group, { key: "Home" });
    expect(status.textContent).toContain("Jan 2026");
    fireEvent.keyDown(group, { key: "ArrowLeft" });
    expect(status.textContent).toContain("Jan 2026");
    fireEvent.keyDown(group, { key: "End" });
    expect(status.textContent).toContain("Mar 2026");
  });

  it("clears on Escape and on blur", () => {
    const { group, status } = renderCursor();
    fireEvent.keyDown(group, { key: "End" });
    fireEvent.keyDown(group, { key: "Escape" });
    expect(status.textContent).toBe("");
    fireEvent.keyDown(group, { key: "Home" });
    fireEvent.blur(group);
    expect(status.textContent).toBe("");
  });

  it("draws a guide and one dot per value at the active point", () => {
    const { group } = renderCursor();
    fireEvent.keyDown(group, { key: "ArrowRight" });
    fireEvent.keyDown(group, { key: "ArrowRight" });
    const guide = group.querySelector(".sft-chart-cursor-guide");
    const dots = group.querySelectorAll(".sft-chart-cursor-dot");
    expect(guide?.getAttribute("style")).toBe("left: 50%;");
    expect(dots).toHaveLength(1);
    expect(dots[0]?.getAttribute("style")).toBe("left: 50%; bottom: 40%;");
    expect(dots[0]?.getAttribute("class")).toContain("sft-chart-series-1");
  });

  it("picks the point nearest to the pointer, measured on the plot", () => {
    const { group, status } = renderCursor();
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(DOMRect.fromRect({ x: 100, y: 0, width: 200, height: 100 }));
    // 100 + 0.8 × 200: 80 % of the plot is nearest to the point at 100 %.
    fireEvent.pointerMove(group, { clientX: 260 });
    expect(status.textContent).toContain("Mar 2026");
    // 30 % is nearest to the point at 50 %.
    fireEvent.pointerMove(group, { clientX: 160 });
    expect(status.textContent).toContain("Feb 2026");
    fireEvent.pointerLeave(group);
    expect(status.textContent).toBe("");
  });

  it("ignores keys and the pointer without points", () => {
    const { group, status } = renderCursor([]);
    fireEvent.keyDown(group, { key: "ArrowRight" });
    fireEvent.keyDown(group, { key: "End" });
    expect(status.textContent).toBe("");
  });

  it("keeps other keys for the page", () => {
    const { group } = renderCursor();
    const event = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
    group.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });
});

describe("ChartCursor options", () => {
  it("renders an app's readout in the live region with the point and its index", () => {
    render(
      <ChartCursor title="Savings over time" points={POINTS} renderReadout={(point, index) => <p className="app-readout">{`${point.heading} #${String(index)}`}</p>}>
        <div className="sft-chart-plot" />
      </ChartCursor>,
    );
    const group = screen.getByRole("group");
    const status = screen.getByRole("status");
    fireEvent.keyDown(group, { key: "End" });
    expect(status.getAttribute("aria-live")).toBe("polite");
    expect(status.innerHTML).toBe('<p class="app-readout">Mar 2026 #2</p>');
    fireEvent.keyDown(group, { key: "Escape" });
    expect(status.textContent).toBe("");
  });

  it("reports each change of the active stop once", () => {
    const onActiveChange = vi.fn();
    render(
      <ChartCursor title="Savings over time" points={POINTS} onActiveChange={onActiveChange}>
        <div className="sft-chart-plot" />
      </ChartCursor>,
    );
    const group = screen.getByRole("group");
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(DOMRect.fromRect({ x: 0, y: 0, width: 100, height: 100 }));
    fireEvent.keyDown(group, { key: "ArrowRight" });
    fireEvent.pointerMove(group, { clientX: 45 });
    fireEvent.pointerMove(group, { clientX: 55 });
    fireEvent.keyDown(group, { key: "ArrowRight" });
    fireEvent.keyDown(group, { key: "ArrowRight" });
    fireEvent.keyDown(group, { key: "Escape" });
    fireEvent.blur(group);
    expect(onActiveChange.mock.calls).toEqual([[0], [1], [2], [null]]);
  });

  it("without the frame puts the children and the cursor layer in one box measured by the pointer", () => {
    render(
      <ChartCursor title="Savings over time" points={POINTS} frame={false}>
        <svg className="app-plot" />
      </ChartCursor>,
    );
    const group = screen.getByRole("group");
    expect(group.querySelector(".sft-chart-frame")).toBeNull();
    const box = group.querySelector(".sft-chart-cursor-box");
    expect([...(box?.children ?? [])].map((child) => child.getAttribute("class"))).toEqual(["app-plot", "sft-chart-cursor-layer"]);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(DOMRect.fromRect({ x: 100, y: 0, width: 200, height: 100 }));
    fireEvent.pointerMove(group, { clientX: 210 });
    expect(box?.querySelector(".sft-chart-cursor-guide")?.getAttribute("style")).toBe("left: 50%;");
    expect(box?.querySelector(".sft-chart-cursor-dot")?.getAttribute("style")).toBe("left: 50%; bottom: 40%;");
  });

  it("keeps the frame grid by default", () => {
    const { group } = renderCursor();
    const frame = group.querySelector(".sft-chart-frame");
    expect(frame?.lastElementChild?.getAttribute("class")).toBe("sft-chart-cursor-layer");
    expect(group.querySelector(".sft-chart-cursor-box")).toBeNull();
  });

  it("colours a dot and its swatch by tone or class when there is no slot, and a slot wins over a tone", () => {
    const points: CursorPoint[] = [
      {
        key: 0,
        xPercent: 20,
        heading: "Jan 2026",
        values: [
          { key: "accessible", tone: "success", className: "app-accessible", yPercent: 30, label: "Accessible", value: "3,000" },
          { key: "locked", className: "app-locked", yPercent: 60, label: "Locked", value: "6,000" },
          { key: "series", slot: 2, tone: "danger", yPercent: 90, label: "Total", value: "9,000" },
        ],
      },
    ];
    const { group, status } = renderCursor(points);
    fireEvent.keyDown(group, { key: "Home" });
    const dots = [...group.querySelectorAll(".sft-chart-cursor-dot")].map((dot) => dot.getAttribute("class"));
    expect(dots).toEqual([
      "sft-chart-cursor-dot sft-chart-tone-success sft-chart-fill-tone app-accessible",
      "sft-chart-cursor-dot app-locked",
      "sft-chart-cursor-dot sft-chart-series-2",
    ]);
    const swatches = [...status.querySelectorAll(".sft-chart-swatch")].map((swatch) => swatch.getAttribute("class"));
    expect(swatches).toEqual([
      "sft-chart-swatch sft-chart-swatch-dot sft-chart-tone-success sft-chart-fill-tone app-accessible",
      "sft-chart-swatch sft-chart-swatch-dot app-locked",
      "sft-chart-swatch sft-chart-swatch-dot sft-chart-series-2",
    ]);
  });

  it("adds the app's class to the readout and keeps the default one without it", () => {
    render(
      <ChartCursor title="Savings over time" points={POINTS} readoutClassName="app-readout-float">
        <div className="sft-chart-plot" />
      </ChartCursor>,
    );
    expect(screen.getByRole("status").getAttribute("class")).toBe("sft-chart-readout app-readout-float");
    cleanup();
    const { status } = renderCursor();
    expect(status.getAttribute("class")).toBe("sft-chart-readout");
  });
});
