// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { clampSize, RESIZE_HANDLE_STEP, ResizeHandle } from "../../src/index.js";

afterEach(cleanup);

const MIN = 160;
const MAX = 480;
const DEFAULT = 240;

function Harness({ initial = DEFAULT, onChange = vi.fn(), onCommit = vi.fn() }: { initial?: number; onChange?: (value: number) => void; onCommit?: (value: number) => void }) {
  const [width, setWidth] = useState(initial);
  return (
    <ResizeHandle
      label="Resize the list"
      controls="list"
      value={width}
      min={MIN}
      max={MAX}
      defaultValue={DEFAULT}
      onChange={(value) => {
        setWidth(value);
        onChange(value);
      }}
      onCommit={onCommit}
    />
  );
}

function handle(): HTMLElement {
  return screen.getByRole("separator", { name: "Resize the list" });
}

describe("clampSize", () => {
  it("keeps a value within the limits and rounds it", () => {
    expect(clampSize(100, MIN, MAX)).toBe(MIN);
    expect(clampSize(900, MIN, MAX)).toBe(MAX);
    expect(clampSize(300.6, MIN, MAX)).toBe(301);
    expect(clampSize(MIN, MIN, MAX)).toBe(MIN);
    expect(clampSize(MAX, MIN, MAX)).toBe(MAX);
  });

  it("falls back for a value that is not a finite number", () => {
    expect(clampSize(Number.NaN, MIN, MAX, DEFAULT)).toBe(DEFAULT);
    expect(clampSize(Number.POSITIVE_INFINITY, MIN, MAX, DEFAULT)).toBe(DEFAULT);
    expect(clampSize(Number.NaN, MIN, MAX)).toBe(MIN);
    expect(clampSize(Number.NaN, MIN, MAX, 9999)).toBe(MAX);
  });
});

describe("ResizeHandle", () => {
  it("is a focusable vertical separator that names its column and its limits", () => {
    render(<Harness />);
    const separator = handle();

    expect(separator.getAttribute("aria-orientation")).toBe("vertical");
    expect(separator.getAttribute("aria-controls")).toBe("list");
    expect(separator.getAttribute("aria-valuenow")).toBe(String(DEFAULT));
    expect(separator.getAttribute("aria-valuemin")).toBe(String(MIN));
    expect(separator.getAttribute("aria-valuemax")).toBe(String(MAX));
    expect(separator.tabIndex).toBe(0);
    expect(separator.dataset["slot"]).toBe("resize-handle");
    expect(separator.className).toContain("max-sm:hidden");
  });

  it("follows a drag and keeps the width once the pointer is let go", () => {
    const onChange = vi.fn();
    const onCommit = vi.fn();
    render(<Harness onChange={onChange} onCommit={onCommit} />);

    fireEvent.pointerDown(handle(), { pointerId: 1, button: 0, clientX: 400 });
    expect(handle().dataset["dragging"]).toBe("true");
    fireEvent.pointerMove(handle(), { pointerId: 1, clientX: 450 });
    fireEvent.pointerMove(handle(), { pointerId: 1, clientX: 480 });
    expect(onCommit).not.toHaveBeenCalled();
    fireEvent.pointerUp(handle(), { pointerId: 1, clientX: 480 });

    expect(onChange.mock.calls).toEqual([[290], [320]]);
    expect(onCommit.mock.calls).toEqual([[320]]);
    expect(handle().getAttribute("aria-valuenow")).toBe("320");
    expect(handle().dataset["dragging"]).toBeUndefined();
  });

  it("stops a drag at the limits", () => {
    const onCommit = vi.fn();
    render(<Harness onCommit={onCommit} />);

    fireEvent.pointerDown(handle(), { pointerId: 1, button: 0, clientX: 400 });
    fireEvent.pointerMove(handle(), { pointerId: 1, clientX: 2000 });
    expect(handle().getAttribute("aria-valuenow")).toBe(String(MAX));
    fireEvent.pointerMove(handle(), { pointerId: 1, clientX: -2000 });
    fireEvent.pointerUp(handle(), { pointerId: 1 });

    expect(onCommit.mock.calls).toEqual([[MIN]]);
  });

  it("ignores a secondary button, another pointer and a move without a press", () => {
    const onChange = vi.fn();
    const onCommit = vi.fn();
    render(<Harness onChange={onChange} onCommit={onCommit} />);

    fireEvent.pointerMove(handle(), { pointerId: 1, clientX: 500 });
    fireEvent.pointerDown(handle(), { pointerId: 1, button: 2, clientX: 400 });
    fireEvent.pointerMove(handle(), { pointerId: 1, clientX: 500 });
    fireEvent.pointerDown(handle(), { pointerId: 1, button: 0, clientX: 400 });
    fireEvent.pointerMove(handle(), { pointerId: 2, clientX: 500 });
    fireEvent.pointerUp(handle(), { pointerId: 1 });

    expect(onChange).not.toHaveBeenCalled();
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("steps by the arrow keys, four times with Shift, and goes to the limits with Home and End", () => {
    const onCommit = vi.fn();
    render(<Harness onCommit={onCommit} />);

    fireEvent.keyDown(handle(), { key: "ArrowRight" });
    fireEvent.keyDown(handle(), { key: "ArrowLeft", shiftKey: true });
    fireEvent.keyDown(handle(), { key: "End" });
    fireEvent.keyDown(handle(), { key: "End" });
    fireEvent.keyDown(handle(), { key: "Home" });
    fireEvent.keyDown(handle(), { key: "Enter" });

    expect(onCommit.mock.calls).toEqual([[DEFAULT + RESIZE_HANDLE_STEP], [DEFAULT + RESIZE_HANDLE_STEP - 4 * RESIZE_HANDLE_STEP], [MAX], [MIN]]);
  });

  it("restores the default on a double click, and keeps nothing when already there", () => {
    const onCommit = vi.fn();
    render(<Harness initial={400} onCommit={onCommit} />);

    fireEvent.doubleClick(handle());
    fireEvent.doubleClick(handle());

    expect(onCommit.mock.calls).toEqual([[DEFAULT]]);
    expect(handle().getAttribute("aria-valuenow")).toBe(String(DEFAULT));
  });
});
