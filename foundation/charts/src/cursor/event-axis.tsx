"use client";

import { formatMessage } from "@softure-ai/core";
import { useUiLocale } from "@softure-ai/ui";
import { type CSSProperties, type KeyboardEvent, type ReactNode, useState } from "react";
import { type ChartsCopyProps, getChartsCopy } from "../messages/index.js";
import { cx, seriesColourClass, seriesColourStyle } from "../svg/class-names.js";
import { type EventAxisItem, layoutEventAxis } from "../svg/event-layout.js";
import { percent } from "../svg/geometry.js";
import { getNextIndex } from "./cursor-keys.js";

export interface EventAxisProps extends ChartsCopyProps {
  /** The axis' title, part of its accessible name. */
  readonly title: string;
  /** Spans and milestones, positioned by the same x scale as the chart above or below. */
  readonly items: readonly EventAxisItem[];
  readonly className?: string;
  /** The readout's content for the active item instead of its label and detail; announced by the same live region. */
  readonly renderReadout?: (item: EventAxisItem, index: number) => ReactNode;
  /** Called once per change of the active item, with its index in `items`, or `null` when it clears. */
  readonly onActiveChange?: (index: number | null) => void;
  /** Added to the readout. */
  readonly readoutClassName?: string;
}

/**
 * A horizontal timeline of spans (bars with their label) and milestones (dots on a row of their own), packed into as
 * few rows as keep spans apart (`layoutEventAxis`). It works like `ChartCursor`: a focusable group where ← and → step
 * through the items by start, Home and End jump to the ends and Escape clears; the pointer activates the item under
 * it, and leaving or blurring clears. The readout under the track is a polite live region. Place it under a chart
 * with the same x scale, or alone with a `TimeAxis`.
 */
export function EventAxis({ title, items, className, renderReadout, onActiveChange, readoutClassName, locale, messages }: EventAxisProps) {
  const [activeStep, setActiveStep] = useState<number | null>(null);
  const copy = getChartsCopy({ locale: useUiLocale(locale), messages });
  const { entries, lanes } = layoutEventAxis(items);
  const active = activeStep === null ? null : (entries[activeStep] ?? null);

  function changeActive(next: number | null) {
    if (next === activeStep) return;
    setActiveStep(next);
    onActiveChange?.(next === null ? null : (entries[next]?.index ?? null));
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      changeActive(null);
      return;
    }
    const next = getNextIndex(event.key, activeStep, entries.length - 1);
    if (next === undefined) return;
    event.preventDefault();
    changeActive(next);
  }

  return (
    <div
      className={cx("sft-chart-event-axis", className)}
      role="group"
      tabIndex={0}
      aria-label={formatMessage(copy.eventAxis.label, { title })}
      onKeyDown={handleKeyDown}
      onBlur={() => changeActive(null)}
      onPointerLeave={() => changeActive(null)}
    >
      <div aria-hidden="true" className="sft-chart-event-track" style={{ "--sft-chart-event-lanes": lanes } as CSSProperties}>
        {entries.map(({ item, lane, startPercent, endPercent }, step) => {
          const isSpan = item.kind === "span";
          const style = {
            "--sft-chart-event-lane": lane,
            left: percent(startPercent),
            ...(isSpan ? { width: percent(endPercent - startPercent) } : {}),
            ...seriesColourStyle(item.color),
          } as CSSProperties;
          return (
            <span
              key={item.key}
              data-key={item.key}
              className={cx(
                "sft-chart-event",
                `sft-chart-event-${item.kind}`,
                seriesColourClass({ slot: item.slot, tone: item.tone }),
                step === activeStep && "sft-chart-event-active",
              )}
              style={style}
              onPointerEnter={() => changeActive(step)}
              onPointerDown={() => changeActive(step)}
            >
              {isSpan && <span className="sft-chart-event-label">{item.label}</span>}
            </span>
          );
        })}
      </div>
      <div className={cx("sft-chart-readout", readoutClassName)} role="status" aria-live="polite" aria-atomic="true">
        {active && renderReadout && renderReadout(active.item, active.index)}
        {active && !renderReadout && (
          <>
            <span className="sft-chart-readout-heading">{active.item.label}</span>
            {active.item.detail !== undefined && (
              <>
                {" "}
                <span className="sft-chart-readout-value">{active.item.detail}</span>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
