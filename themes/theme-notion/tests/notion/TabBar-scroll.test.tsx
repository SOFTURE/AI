// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TabBar } from "../../src/notion/TabBar.js";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  resizeCallbacks.length = 0;
});

// A browser reports a fresh observation once the strip has a size; the fake reports it when `layOut` gives it one.
const resizeCallbacks: (() => void)[] = [];
beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      readonly #callback: () => void;
      constructor(callback: () => void) {
        this.#callback = callback;
      }
      observe() {
        resizeCallbacks.push(this.#callback);
      }
      disconnect() {
        const index = resizeCallbacks.indexOf(this.#callback);
        if (index >= 0) resizeCallbacks.splice(index, 1);
      }
    },
  );
});

const KEYS = ["ci", "quality", "merges", "releases", "doctor"] as const;
type Key = (typeof KEYS)[number];
const TABS = KEYS.map((key, index) => ({ key, label: key, href: `?tab=${key}`, count: index }));
const TAB_WIDTH = 100;
const STRIP_WIDTH = 250;

// happy-dom lays nothing out: each tab is 100 px wide in a row, the strip shows 250 px of it at its scroll position.
function layOut(nav: HTMLElement, tabCount: number = KEYS.length) {
  Object.defineProperty(nav, "clientWidth", { configurable: true, value: STRIP_WIDTH });
  Object.defineProperty(nav, "scrollWidth", { configurable: true, value: tabCount * TAB_WIDTH });
  vi.spyOn(nav, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, STRIP_WIDTH, 44));
  for (const [index, link] of [...nav.querySelectorAll<HTMLElement>("a[data-tab]")].entries()) {
    vi.spyOn(link, "getBoundingClientRect").mockImplementation(
      () => new DOMRect(index * TAB_WIDTH - nav.scrollLeft, 0, TAB_WIDTH, 44),
    );
  }
  act(() => {
    for (const callback of resizeCallbacks) callback();
  });
}

// Renders once to lay the strip out, then shows `current`, as a page that opens with `?tab=<current>` does.
function renderTabBar(current: Key, tabs = TABS) {
  const view = render(<TabBar label="History" tabs={tabs} current={tabs[0]?.key ?? "ci"} size="touch" />);
  const nav = view.container.querySelector<HTMLElement>('[data-slot="tab-bar"]');
  if (nav === null) throw new Error("no tab bar rendered");
  layOut(nav, tabs.length);
  view.rerender(<TabBar label="History" tabs={tabs} current={current} size="touch" />);
  return { ...view, nav };
}

function scrollTo(nav: HTMLElement, left: number) {
  nav.scrollLeft = left;
  act(() => {
    fireEvent.scroll(nav);
  });
}

describe("TabBar current tab in view", () => {
  it("scrolls the strip so a late current tab ends at its right edge", () => {
    const { nav } = renderTabBar("doctor");

    expect(nav.scrollLeft).toBe(5 * TAB_WIDTH - STRIP_WIDTH);
  });

  it("leaves the strip at its start when the current tab is already in view", () => {
    const { nav } = renderTabBar("quality");

    expect(nav.scrollLeft).toBe(0);
  });

  it("scrolls back to an earlier tab that has left the view on the start side", () => {
    const { nav, rerender } = renderTabBar("doctor");

    rerender(<TabBar label="History" tabs={TABS} current="quality" size="touch" />);

    expect(nav.scrollLeft).toBe(TAB_WIDTH);
  });

  it("moves only the strip, never the page", () => {
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: scrollIntoView });
    const windowScroll = vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);

    renderTabBar("releases");

    expect(scrollIntoView).not.toHaveBeenCalled();
    expect(windowScroll).not.toHaveBeenCalled();
  });
});

describe("TabBar overflow cue", () => {
  it("marks the end edge at the start of an overflowing strip", () => {
    const { nav } = renderTabBar("ci");

    expect(nav.hasAttribute("data-overflow-start")).toBe(false);
    expect(nav.hasAttribute("data-overflow-end")).toBe(true);
  });

  it("marks both edges in the middle and only the start edge at the end", () => {
    const { nav } = renderTabBar("ci");

    scrollTo(nav, 100);
    expect(nav.hasAttribute("data-overflow-start")).toBe(true);
    expect(nav.hasAttribute("data-overflow-end")).toBe(true);

    scrollTo(nav, 5 * TAB_WIDTH - STRIP_WIDTH);
    expect(nav.hasAttribute("data-overflow-start")).toBe(true);
    expect(nav.hasAttribute("data-overflow-end")).toBe(false);
  });

  it("marks the start edge after scrolling a late current tab into view", () => {
    const { nav } = renderTabBar("doctor");

    expect(nav.hasAttribute("data-overflow-start")).toBe(true);
    expect(nav.hasAttribute("data-overflow-end")).toBe(false);
  });

  it("marks no edge when every tab fits", () => {
    const { nav } = renderTabBar("quality", TABS.slice(0, 2));

    expect(nav.hasAttribute("data-overflow-start")).toBe(false);
    expect(nav.hasAttribute("data-overflow-end")).toBe(false);
  });

  it("fades each marked edge with a static mask", () => {
    const { nav } = renderTabBar("ci");

    expect(nav.className.split(" ")).toEqual(
      expect.arrayContaining(["data-overflow-start:mask-l-from-[calc(100%---spacing(8))]", "data-overflow-end:mask-r-from-[calc(100%---spacing(8))]"]),
    );
  });
});
