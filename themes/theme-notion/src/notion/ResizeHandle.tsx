"use client";

import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

import { cn } from "../lib/utils.js";

import { clampSize } from "./clamp-size.js";

/** The keyboard step of an arrow key, in pixels; Shift takes four of them. */
export const RESIZE_HANDLE_STEP = 16;
const LARGE_STEP_FACTOR = 4;

export interface ResizeHandleProps {
  /** The handle's accessible name, from the app's message layer (e.g. "Resize the plan column"). */
  readonly label: string;
  /** The id of the column the handle resizes. */
  readonly controls: string;
  /** The column's width in pixels (controlled). */
  readonly value: number;
  readonly min: number;
  readonly max: number;
  /** The width a double click restores. */
  readonly defaultValue: number;
  /** Every new width, during a drag and on each key. */
  readonly onChange: (value: number) => void;
  /** The width once a drag, a key or the reset ends: the moment to keep it. */
  readonly onCommit?: (value: number) => void;
  readonly className?: string;
}

interface Drag {
  readonly pointerId: number;
  readonly startX: number;
  readonly startValue: number;
}

/**
 * A vertical handle on the right edge of a column that a pointer drags, or the keyboard steps, to set the column's width.
 * It takes no width of its own (it lies over the border between two columns) and shows the theme's ring colour while
 * hovered, focused or dragged. Arrow keys step the width (Shift: four steps), Home and End go to the limits, a double
 * click restores the default. Hidden phone-wide, where the columns stack.
 */
export function ResizeHandle({ label, controls, value, min, max, defaultValue, onChange, onCommit, className }: ResizeHandleProps) {
  const dragRef = useRef<Drag | null>(null);
  const lastRef = useRef(value);
  const [isDragging, setIsDragging] = useState(false);
  lastRef.current = value;

  function change(next: number): number {
    const clamped = clampSize(next, min, max, defaultValue);
    if (clamped !== lastRef.current) {
      lastRef.current = clamped;
      onChange(clamped);
    }
    return clamped;
  }

  function startDrag(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragRef.current = { pointerId: event.pointerId, startX: event.clientX, startValue: value };
    setIsDragging(true);
  }

  function moveDrag(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (drag === null || drag.pointerId !== event.pointerId) return;
    change(drag.startValue + event.clientX - drag.startX);
  }

  function endDrag(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (drag === null || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setIsDragging(false);
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    if (lastRef.current !== drag.startValue) onCommit?.(lastRef.current);
  }

  function stepByKey(event: KeyboardEvent<HTMLDivElement>) {
    const step = event.shiftKey ? RESIZE_HANDLE_STEP * LARGE_STEP_FACTOR : RESIZE_HANDLE_STEP;
    const targets: Record<string, number> = { ArrowLeft: value - step, ArrowRight: value + step, Home: min, End: max };
    const target = targets[event.key];
    if (target === undefined) return;
    event.preventDefault();
    const before = value;
    const next = change(target);
    if (next !== before) onCommit?.(next);
  }

  function restoreDefault() {
    const before = value;
    const next = change(defaultValue);
    if (next !== before) onCommit?.(next);
  }

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-controls={controls}
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      title={label}
      data-slot="resize-handle"
      data-dragging={isDragging ? "true" : undefined}
      className={cn(
        "relative z-4 -mx-1 w-2 flex-none cursor-col-resize touch-none select-none outline-none max-sm:hidden",
        "after:absolute after:inset-y-0 after:left-1/2 after:w-0.5 after:-translate-x-1/2 after:bg-transparent after:transition-colors",
        "hover:after:bg-ring focus-visible:after:bg-ring data-[dragging=true]:after:bg-ring",
        className,
      )}
      onPointerDown={startDrag}
      onPointerMove={moveDrag}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={stepByKey}
      onDoubleClick={restoreDefault}
    />
  );
}
