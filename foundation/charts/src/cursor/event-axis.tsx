"use client";

import { formatMessage } from "@softure-ai/core";
import { useUiLocale } from "@softure-ai/ui";
import { type CSSProperties, type KeyboardEvent, type ReactElement, type ReactNode, useState } from "react";
import { type ChartsCopyProps, getChartsCopy } from "../messages/index.js";
import { cx, seriesColourClass, seriesColourStyle } from "../svg/class-names.js";
import {
  type EventAxisEntry,
  type EventAxisItem,
  type EventAxisMilestone,
  type EventRailEntry,
  layoutEventAxis,
  layoutEventRail,
} from "../svg/event-layout.js";
import { percent } from "../svg/geometry.js";
import { getNextIndex } from "./cursor-keys.js";

interface EventAxisBaseProps extends ChartsCopyProps {
  /** The axis' title, part of its accessible name. */
  readonly title: string;
  readonly className?: string;
  /** The readout's content for the active item instead of its label and detail; announced by the same live region. */
  readonly renderReadout?: (item: EventAxisItem, index: number) => ReactNode;
  /** Called once per change of the active item, with its index in `items`, or `null` when it clears. */
  readonly onActiveChange?: (index: number | null) => void;
  /** Added to the readout. */
  readonly readoutClassName?: string;
}

/** Spans and milestones on rows of their own (the default layout). */
export interface EventAxisProps extends EventAxisBaseProps {
  readonly layout?: "lanes";
  /** Spans and milestones, positioned by the same x scale as the chart above or below. */
  readonly items: readonly EventAxisItem[];
}

/** Milestones on one rail, the segment leading to each coloured and labelled on its own. */
export interface EventAxisRailProps extends EventAxisBaseProps {
  readonly layout: "rail";
  /** Milestones, positioned by the same x scale as the chart above or below. */
  readonly items: readonly EventAxisMilestone[];
  /** The narrowest segment, in axis percent, that still shows its `segmentLabel`. Default 0: every label shows. */
  readonly minLabelWidth?: number;
}

type Stop = Pick<EventAxisEntry, "item" | "index">;

/**
 * A horizontal timeline. By default spans (bars with their label) and milestones (dots on a row of their own), packed
 * into as few rows as keep spans apart (`layoutEventAxis`); with `layout="rail"` milestones on one line, each joined
 * to the previous one by a segment with its own colour and label, and a tick under each dot (`layoutEventRail`). It
 * works like `ChartCursor`: a focusable group where ← and → step through the items by start, Home and End jump to the
 * ends and Escape clears; the pointer activates the item under it (on a rail, a segment activates the milestone it
 * leads to), and leaving or blurring clears. The readout under the track is a polite live region. Place it under a
 * chart with the same x scale, or alone with a `TimeAxis`.
 */
export function EventAxis(props: EventAxisRailProps): ReactElement;
// The default layout comes last, so `Parameters<typeof EventAxis>[0]` stays `EventAxisProps` as before the rail.
export function EventAxis(props: EventAxisProps): ReactElement;
export function EventAxis(props: EventAxisProps | EventAxisRailProps): ReactElement {
  const { title, className, renderReadout, onActiveChange, readoutClassName, locale, messages } = props;
  const [activeStep, setActiveStep] = useState<number | null>(null);
  const copy = getChartsCopy({ locale: useUiLocale(locale), messages });
  const isRail = props.layout === "rail";
  const lanes = isRail ? null : layoutEventAxis(props.items);
  const rail = isRail ? layoutEventRail(props.items, { minLabelWidth: props.minLabelWidth }) : null;
  const stops: readonly Stop[] = lanes?.entries ?? rail?.entries ?? [];
  const active = activeStep === null ? null : (stops[activeStep] ?? null);

  function changeActive(next: number | null) {
    if (next === activeStep) return;
    setActiveStep(next);
    onActiveChange?.(next === null ? null : (stops[next]?.index ?? null));
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      changeActive(null);
      return;
    }
    const next = getNextIndex(event.key, activeStep, stops.length - 1);
    if (next === undefined) return;
    event.preventDefault();
    changeActive(next);
  }

  return (
    <div
      className={cx("sft-chart-event-axis", isRail && "sft-chart-event-axis-rail", className)}
      role="group"
      tabIndex={0}
      aria-label={formatMessage(copy.eventAxis.label, { title })}
      onKeyDown={handleKeyDown}
      onBlur={() => changeActive(null)}
      onPointerLeave={() => changeActive(null)}
    >
      {lanes && <EventLanesTrack entries={lanes.entries} lanes={lanes.lanes} activeStep={activeStep} onActivate={changeActive} />}
      {rail && <EventRailTrack entries={rail.entries} activeStep={activeStep} onActivate={changeActive} />}
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

interface TrackProps<Entry> {
  readonly entries: readonly Entry[];
  readonly activeStep: number | null;
  readonly onActivate: (step: number) => void;
}

function EventLanesTrack({ entries, lanes, activeStep, onActivate }: TrackProps<EventAxisEntry> & { readonly lanes: number }) {
  return (
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
            onPointerEnter={() => onActivate(step)}
            onPointerDown={() => onActivate(step)}
          >
            {isSpan && <span className="sft-chart-event-label">{item.label}</span>}
          </span>
        );
      })}
    </div>
  );
}

function EventRailTrack({ entries, activeStep, onActivate }: TrackProps<EventRailEntry>) {
  return (
    <div aria-hidden="true" className="sft-chart-event-track sft-chart-event-rail">
      {entries.map(({ item, segment }, step) => {
        if (!segment) return null;
        // The segment's own colour; without one it takes the milestone's.
        const hasRailColour = item.railSlot !== undefined || item.railTone !== undefined || item.railColor !== undefined;
        const colour = hasRailColour ? { slot: item.railSlot, tone: item.railTone, color: item.railColor } : item;
        return (
          <span
            key={`${item.key}-segment`}
            data-key={item.key}
            className={cx("sft-chart-event-segment", seriesColourClass(colour), step === activeStep && "sft-chart-event-active")}
            style={{ left: percent(segment.startPercent), width: percent(segment.endPercent - segment.startPercent), ...seriesColourStyle(colour.color) }}
            onPointerEnter={() => onActivate(step)}
            onPointerDown={() => onActivate(step)}
          >
            {segment.isLabelShown && <span className="sft-chart-event-label">{item.segmentLabel}</span>}
          </span>
        );
      })}
      {entries.map(({ item, xPercent }, step) => (
        <span
          key={item.key}
          data-key={item.key}
          className={cx(
            "sft-chart-event",
            "sft-chart-event-milestone",
            seriesColourClass({ slot: item.slot, tone: item.tone }),
            step === activeStep && "sft-chart-event-active",
          )}
          style={{ left: percent(xPercent), ...seriesColourStyle(item.color) }}
          onPointerEnter={() => onActivate(step)}
          onPointerDown={() => onActivate(step)}
        />
      ))}
      {entries.map(({ item, xPercent }) =>
        item.tick === undefined ? null : (
          <span key={`${item.key}-tick`} data-key={item.key} className="sft-chart-event-tick" style={{ left: percent(xPercent) }}>
            {item.tick}
          </span>
        ),
      )}
    </div>
  );
}
