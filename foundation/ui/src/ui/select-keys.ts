// Keyboard model of the listbox `Select` (WAI-ARIA select-only combobox), as a pure function so
// every key is unit-tested.

export interface SelectKeyState {
  readonly isOpen: boolean;
  /** The highlighted option while open (`aria-activedescendant`), -1 when closed. */
  readonly activeIndex: number;
  /** Letters typed in quick succession and when the last one came. */
  readonly typeahead: { readonly text: string; readonly at: number };
}

export interface SelectKeyResult {
  readonly state: SelectKeyState;
  /** The option to select, or `null` to keep the current value. */
  readonly commitIndex: number | null;
  /** Whether the key belongs to the select (the page must not scroll or submit). */
  readonly preventDefault: boolean;
}

export const CLOSED_SELECT: SelectKeyState = { isOpen: false, activeIndex: -1, typeahead: { text: "", at: 0 } };

/** Letters typed within this window join one prefix. */
const TYPEAHEAD_WINDOW_MS = 500;
/** How far PageUp and PageDown move. */
const PAGE_STEP = 10;

export interface SelectKeyInput {
  readonly state: SelectKeyState;
  /** `KeyboardEvent.key`. */
  readonly key: string;
  readonly labels: readonly string[];
  /** The selected option, -1 when none. */
  readonly selectedIndex: number;
  /** Milliseconds, for the typeahead window. */
  readonly now: number;
  /** Locale used to compare typed letters with labels. */
  readonly locale: string;
}

function clamp(index: number, count: number): number {
  return Math.min(Math.max(index, 0), count - 1);
}

function keep(state: SelectKeyState): SelectKeyResult {
  return { state, commitIndex: null, preventDefault: false };
}

function open(activeIndex: number, count: number): SelectKeyResult {
  return {
    state: { isOpen: true, activeIndex: clamp(activeIndex, count), typeahead: { text: "", at: 0 } },
    commitIndex: null,
    preventDefault: true,
  };
}

function isTypeaheadRunning(state: SelectKeyState, now: number): boolean {
  return state.typeahead.text !== "" && now - state.typeahead.at < TYPEAHEAD_WINDOW_MS;
}

/** The first label starting with `prefix`, searching from `from` (after it for a single letter). */
function findByPrefix({ labels, prefix, from, locale }: { labels: readonly string[]; prefix: string; from: number; locale: string }): number {
  const count = labels.length;
  const start = prefix.length === 1 ? from + 1 : from;
  for (let step = 0; step < count; step += 1) {
    const index = (((start + step) % count) + count) % count;
    if ((labels[index] ?? "").toLocaleLowerCase(locale).startsWith(prefix)) return index;
  }
  return -1;
}

function typeahead({ state, key, labels, selectedIndex, now, locale }: SelectKeyInput): SelectKeyResult {
  const typed = (isTypeaheadRunning(state, now) ? state.typeahead.text : "") + key.toLocaleLowerCase(locale);
  // The same letter pressed again moves to the next match instead of searching for "ee".
  const isRepeatedLetter = typed.length > 1 && [...typed].every((char) => char === typed[0]);
  const prefix = isRepeatedLetter ? typed.charAt(0) : typed;
  const from = state.isOpen ? state.activeIndex : Math.max(selectedIndex, 0);
  const match = findByPrefix({ labels, prefix, from, locale });
  return {
    state: { isOpen: true, activeIndex: match === -1 ? clamp(from, labels.length) : match, typeahead: { text: typed, at: now } },
    commitIndex: null,
    preventDefault: true,
  };
}

/** The select's next state after a key press. */
export function getNextSelectState(input: SelectKeyInput): SelectKeyResult {
  const { state, key, labels, selectedIndex, now } = input;
  const count = labels.length;
  if (count === 0) return keep(state);
  const isCharacter = key.length === 1;

  if (!state.isOpen) {
    const current = selectedIndex < 0 ? 0 : selectedIndex;
    switch (key) {
      case "ArrowDown":
      case "ArrowUp":
      case "Enter":
      case " ":
        return open(current, count);
      case "Home":
        return open(0, count);
      case "End":
        return open(count - 1, count);
      default:
        return isCharacter ? typeahead(input) : keep(state);
    }
  }

  // A space while typing is part of the prefix ("New York"), not a selection.
  if (key === " " && isTypeaheadRunning(state, now)) return typeahead(input);

  const move = (activeIndex: number): SelectKeyResult => ({
    state: { ...state, activeIndex: clamp(activeIndex, count) },
    commitIndex: null,
    preventDefault: true,
  });
  switch (key) {
    case "ArrowDown":
      return move(state.activeIndex + 1);
    case "ArrowUp":
      return move(state.activeIndex - 1);
    case "Home":
      return move(0);
    case "End":
      return move(count - 1);
    case "PageDown":
      return move(state.activeIndex + PAGE_STEP);
    case "PageUp":
      return move(state.activeIndex - PAGE_STEP);
    case "Enter":
    case " ":
      return { state: CLOSED_SELECT, commitIndex: state.activeIndex, preventDefault: true };
    case "Escape":
      // Prevented, so a modal under the list stays open: Escape closes the list first.
      return { state: CLOSED_SELECT, commitIndex: null, preventDefault: true };
    case "Tab":
      // Selects the highlighted option and lets focus move on.
      return { state: CLOSED_SELECT, commitIndex: state.activeIndex, preventDefault: false };
    default:
      return isCharacter ? typeahead(input) : keep(state);
  }
}
