import { describe, expect, it } from "vitest";
import { CLOSED_SELECT, getNextSelectState, type SelectKeyInput, type SelectKeyState } from "../src/index.js";

const CURRENCIES = ["PLN (zloty)", "EUR (euro)", "USD (dollar)", "GBP (pound)", "CHF (franc)"];
const T0 = 1_000_000;

function openAt(activeIndex: number): SelectKeyState {
  return { isOpen: true, activeIndex, typeahead: { text: "", at: 0 } };
}

function press(
  state: SelectKeyState,
  key: string,
  options: Partial<Omit<SelectKeyInput, "state" | "key">> = {},
) {
  return getNextSelectState({ state, key, labels: CURRENCIES, selectedIndex: 1, now: T0, locale: "en", ...options });
}

describe("closed list", () => {
  it.each(["ArrowDown", "ArrowUp", "Enter", " "])("%j opens on the selected option without changing the value", (key) => {
    const result = press(CLOSED_SELECT, key, { selectedIndex: 2 });
    expect(result).toEqual({ state: openAt(2), commitIndex: null, preventDefault: true });
  });

  it("opens on the first or last option with Home and End", () => {
    expect(press(CLOSED_SELECT, "Home").state.activeIndex).toBe(0);
    expect(press(CLOSED_SELECT, "End").state.activeIndex).toBe(4);
  });

  it("lets Tab and Escape through", () => {
    for (const key of ["Tab", "Escape"]) {
      expect(press(CLOSED_SELECT, key)).toEqual({ state: CLOSED_SELECT, commitIndex: null, preventDefault: false });
    }
  });

  it("opens on the first match of a typed letter", () => {
    const result = press(CLOSED_SELECT, "u", { selectedIndex: 0 });
    expect(result.state.isOpen).toBe(true);
    expect(result.state.activeIndex).toBe(2);
  });

  it("does not open without options", () => {
    expect(press(CLOSED_SELECT, "ArrowDown", { labels: [], selectedIndex: -1 }).state.isOpen).toBe(false);
  });

  it("opens on the first option when none is selected", () => {
    expect(press(CLOSED_SELECT, "Enter", { selectedIndex: -1 }).state.activeIndex).toBe(0);
  });
});

describe("open list", () => {
  it("moves the active option with arrows and stops at the ends", () => {
    expect(press(openAt(1), "ArrowDown").state.activeIndex).toBe(2);
    expect(press(openAt(4), "ArrowDown").state.activeIndex).toBe(4);
    expect(press(openAt(1), "ArrowUp").state.activeIndex).toBe(0);
    expect(press(openAt(0), "ArrowUp").state.activeIndex).toBe(0);
  });

  it("jumps with Home, End, PageUp and PageDown, clamped to the list", () => {
    expect(press(openAt(3), "Home").state.activeIndex).toBe(0);
    expect(press(openAt(1), "End").state.activeIndex).toBe(4);
    expect(press(openAt(1), "PageDown").state.activeIndex).toBe(4);
    expect(press(openAt(3), "PageUp").state.activeIndex).toBe(0);
  });

  it.each(["Enter", " "])("%j selects the active option and closes", (key) => {
    expect(press(openAt(3), key)).toEqual({ state: CLOSED_SELECT, commitIndex: 3, preventDefault: true });
  });

  it("closes on Escape without a change and consumes the key, so a modal underneath stays open", () => {
    expect(press(openAt(3), "Escape")).toEqual({ state: CLOSED_SELECT, commitIndex: null, preventDefault: true });
  });

  it("selects the active option on Tab and lets focus move on", () => {
    expect(press(openAt(3), "Tab")).toEqual({ state: CLOSED_SELECT, commitIndex: 3, preventDefault: false });
  });

  it("ignores keys that are not characters", () => {
    expect(press(openAt(0), "Shift")).toEqual({ state: openAt(0), commitIndex: null, preventDefault: false });
  });
});

describe("typeahead", () => {
  it("joins letters typed quickly into one prefix", () => {
    const first = press(openAt(0), "c");
    const second = press(first.state, "h", { now: T0 + 200 });
    expect(first.state.activeIndex).toBe(4);
    expect(second.state.activeIndex).toBe(4);
    expect(second.state.typeahead.text).toBe("ch");
  });

  it("starts over after a pause", () => {
    const first = press(openAt(0), "e");
    const later = press(first.state, "g", { now: T0 + 900 });
    expect(later.state.activeIndex).toBe(3);
    expect(later.state.typeahead.text).toBe("g");
  });

  it("moves to the next match when the same letter is pressed again", () => {
    const labels = ["Employment", "Equity", "Dividends", "Euro"];
    const first = press(openAt(0), "e", { labels });
    const second = press(first.state, "e", { labels, now: T0 + 150 });
    const third = press(second.state, "e", { labels, now: T0 + 300 });
    expect([first, second, third].map((step) => step.state.activeIndex)).toEqual([1, 3, 0]);
  });

  it("matches letters beyond ASCII in either case, in the given locale", () => {
    const labels = ["Cash", "Éclair", "Öl"];
    expect(press(openAt(0), "é", { labels, locale: "pl" }).state.activeIndex).toBe(1);
    expect(press(openAt(0), "Ö", { labels }).state.activeIndex).toBe(2);
  });

  it("keeps the active option when nothing matches", () => {
    expect(press(openAt(2), "q").state.activeIndex).toBe(2);
  });

  it("treats a space while typing as part of the prefix, not a selection", () => {
    const labels = ["Savings account", "Savings bond"];
    const letter = press(openAt(0), "s", { labels });
    const space = press(letter.state, " ", { labels, now: T0 + 100 });
    expect(space.commitIndex).toBeNull();
    expect(space.state.isOpen).toBe(true);
    expect(space.state.typeahead.text).toBe("s ");
  });
});
