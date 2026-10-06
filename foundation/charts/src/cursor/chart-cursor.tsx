"use client";

import { formatMessage } from "@softure-ai/core";
import { type KeyboardEvent, type PointerEvent, type ReactNode, useRef, useState } from "react";
import { type ChartsCopyProps, getChartsCopy } from "../messages/index.js";
import { nearestPointIndex } from "../scale/nearest-point.js";
import { cx, seriesClass } from "../svg/class-names.js";
import { percent } from "../svg/geometry.js";

/** One series' value at a cursor stop. */
export interface CursorValue {
  readonly key: string;
  /** Colour slot of the series (`seriesSlot`). */
  readonly slot: number;
  /** Height of the value from the bottom of the plot, 0–100 %. */
  readonly yPercent: number;
  /** The series' name. */
  readonly label: string;
  /** The value, formatted. */
  readonly value: string;
}

/** A stop of the cursor: a position on the plot and what the readout says there. */
export interface CursorPoint {
  readonly key: string | number;
  /** Position from the left of the plot, 0–100 %, from the same scale as the drawing. */
  readonly xPercent: number;
  /** The readout's heading, usually the formatted date. */
  readonly heading: string;
  readonly values: readonly CursorValue[];
}

export interface ChartCursorProps extends ChartsCopyProps {
  /** The chart's title, part of the cursor's accessible name. */
  readonly title: string;
  /** Stops in drawing order (left to right). */
  readonly points: readonly CursorPoint[];
  /** The frame's content: the value axis, the `ChartPlot` and the time axis. */
  readonly children: ReactNode;
  readonly className?: string;
}

/**
 * The plot as a focusable area with a cursor. A pointer (mouse, pen, or a finger dragging sideways:
 * `touch-action: pan-y` leaves vertical scrolling to the page) snaps to the nearest stop; ← and →
 * step through the stops (the first → lands on the first, the first ← on the last), Home and End
 * jump to the ends, Escape and leaving clear it. The readout under the plot is a polite live region:
 * what it shows is announced. Positions come from the server's scales as percentages, so the cursor
 * never repeats a scale.
 */
export function ChartCursor({ title, points, children, className, locale, messages }: ChartCursorProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const copy = getChartsCopy({ locale, messages });
  const active = activeIndex === null ? null : (points[activeIndex] ?? null);
  const lastIndex = points.length - 1;

  function pickAt(clientX: number) {
    const bounds = layerRef.current?.getBoundingClientRect();
    if (!bounds || bounds.width === 0) return;
    const xPercent = ((clientX - bounds.left) / bounds.width) * 100;
    setActiveIndex(nearestPointIndex(points.map((point) => ({ x: point.xPercent })), xPercent));
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      setActiveIndex(null);
      return;
    }
    const next = getNextIndex(event.key, activeIndex, lastIndex);
    if (next === undefined) return;
    event.preventDefault();
    setActiveIndex(next);
  }

  return (
    <div
      className={cx("sft-chart-cursor", className)}
      role="group"
      tabIndex={0}
      aria-label={formatMessage(copy.cursor.label, { title })}
      onKeyDown={handleKeyDown}
      onBlur={() => setActiveIndex(null)}
      onPointerDown={(event: PointerEvent<HTMLDivElement>) => pickAt(event.clientX)}
      onPointerMove={(event: PointerEvent<HTMLDivElement>) => pickAt(event.clientX)}
      onPointerLeave={() => setActiveIndex(null)}
    >
      <div className="sft-chart-frame">
        {children}
        <div ref={layerRef} className="sft-chart-cursor-layer" aria-hidden="true">
          {active && (
            <>
              <span className="sft-chart-cursor-guide" style={{ left: percent(active.xPercent) }} />
              {active.values.map((value) => (
                <span
                  key={value.key}
                  className={cx("sft-chart-cursor-dot", seriesClass(value.slot))}
                  style={{ left: percent(active.xPercent), bottom: percent(value.yPercent) }}
                />
              ))}
            </>
          )}
        </div>
      </div>
      <div className="sft-chart-readout" role="status" aria-live="polite" aria-atomic="true">
        {active && (
          <>
            <span className="sft-chart-readout-heading">{active.heading}</span>
            {active.values.map((value) => (
              <span key={value.key} className="sft-chart-readout-value">
                {" "}
                <span aria-hidden="true" className={cx("sft-chart-swatch", "sft-chart-swatch-dot", seriesClass(value.slot))} />
                <span>{value.label}</span> <span>{value.value}</span>
              </span>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

/** The stop a key moves to, or `undefined` for a key the cursor leaves to the page. */
function getNextIndex(key: string, current: number | null, lastIndex: number): number | undefined {
  if (lastIndex < 0) return undefined;
  switch (key) {
    case "ArrowRight":
      return current === null ? 0 : Math.min(lastIndex, current + 1);
    case "ArrowLeft":
      return current === null ? lastIndex : Math.max(0, current - 1);
    case "Home":
      return 0;
    case "End":
      return lastIndex;
    default:
      return undefined;
  }
}
