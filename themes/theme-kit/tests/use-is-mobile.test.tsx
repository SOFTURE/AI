// @vitest-environment happy-dom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MOBILE_BREAKPOINT, useIsMobile } from "../src/react/index.js";

type Listener = () => void;

function mockViewport(width: number): { resize: (next: number) => void } {
  let current = width;
  const listeners = new Set<Listener>();
  vi.spyOn(window, "matchMedia").mockImplementation((query: string) => {
    const maxWidth = Number(/max-width: (\d+)px/.exec(query)?.[1]);
    return {
      get matches() {
        return current <= maxWidth;
      },
      media: query,
      addEventListener: (_type: string, listener: Listener) => listeners.add(listener),
      removeEventListener: (_type: string, listener: Listener) => listeners.delete(listener),
    } as unknown as MediaQueryList;
  });
  return {
    resize(next) {
      current = next;
      for (const listener of listeners) listener();
    },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useIsMobile", () => {
  it("is true below the breakpoint and false at it", () => {
    mockViewport(MOBILE_BREAKPOINT - 1);
    expect(renderHook(() => useIsMobile()).result.current).toBe(true);
    vi.restoreAllMocks();
    mockViewport(MOBILE_BREAKPOINT);
    expect(renderHook(() => useIsMobile()).result.current).toBe(false);
  });

  it("follows the viewport when it crosses the breakpoint", () => {
    const viewport = mockViewport(1024);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
    act(() => viewport.resize(500));
    expect(result.current).toBe(true);
  });
});
