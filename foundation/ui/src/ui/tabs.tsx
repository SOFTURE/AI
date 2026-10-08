"use client";

import { type KeyboardEvent, type ReactNode, useId, useRef, useState } from "react";
import { type ClassNames, createSlotClassGetter } from "./class-names.js";
import { SEGMENT_ACTIVE_CLASS, SEGMENT_IDLE_CLASS, SEGMENTED_GROUP_CLASS } from "./segment-classes.js";

// WAI-ARIA tabs: a `tablist` of buttons with roving focus (only the selected tab is in the Tab order; arrows move
// between tabs and wrap, Home and End jump to the ends) and one `tabpanel` per tab. Only the selected panel renders;
// `isAlwaysMounted` keeps a panel in the tree, hidden, so a draft typed in it survives a switch. For a tab bar made of
// links (the route picks the tab) use `SegmentedNav` with `TabPanels` instead.

export type TabsSlot = "root" | "list" | "tab" | "panel";

/** `automatic`: an arrow key selects the tab it reaches. `manual`: arrows move focus, Enter or Space selects. */
export type TabsActivation = "automatic" | "manual";

export interface TabItem<Id extends string> {
  readonly id: Id;
  readonly label: string;
  readonly content: ReactNode;
  /** Render this panel while another tab is selected, hidden, so its state survives a switch. */
  readonly isAlwaysMounted?: boolean;
}

export interface TabsProps<Id extends string> {
  readonly items: readonly TabItem<Id>[];
  /** The tab list's name for assistive technology. */
  readonly label: string;
  /** The selected tab when controlled; pass `onChange` with it. */
  readonly value?: Id;
  /** The first selected tab when uncontrolled; the first item by default. */
  readonly defaultValue?: Id;
  readonly onChange?: (id: Id) => void;
  readonly activation?: TabsActivation;
  readonly classNames?: ClassNames<TabsSlot>;
  readonly unstyled?: boolean;
}

const DEFAULT_CLASSES: Readonly<Record<TabsSlot, string>> = {
  root: "sft:font-sans sft:text-foreground",
  list: SEGMENTED_GROUP_CLASS,
  tab: "",
  panel: "sft:mt-4 sft:focus-visible:outline-2 sft:focus-visible:outline-offset-2 sft:focus-visible:outline-focus",
};

/** The index an arrow, Home or End key moves to from `from`, wrapping at the ends; `undefined` for other keys. */
function getTargetIndex(key: string, from: number, count: number): number | undefined {
  if (key === "ArrowRight") return (from + 1) % count;
  if (key === "ArrowLeft") return (from - 1 + count) % count;
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  return undefined;
}

/** Tabs with their panels. */
export function Tabs<Id extends string>({
  items,
  label,
  value,
  defaultValue,
  onChange,
  activation = "automatic",
  classNames,
  unstyled,
}: TabsProps<Id>) {
  const baseId = useId();
  const [ownValue, setOwnValue] = useState<Id | undefined>(defaultValue ?? items[0]?.id);
  const selected = value ?? ownValue;
  const selectedIndex = Math.max(
    0,
    items.findIndex((item) => item.id === selected),
  );
  const [focusIndex, setFocusIndex] = useState<number | undefined>(undefined);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const slot = createSlotClassGetter({ defaults: DEFAULT_CLASSES, classNames, unstyled });
  // The roving stop: the tab focus last moved to (manual activation), otherwise the selected one.
  const stopIndex = focusIndex ?? selectedIndex;

  function select(index: number) {
    const item = items[index];
    if (item === undefined) return;
    if (value === undefined) setOwnValue(item.id);
    onChange?.(item.id);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (activation === "manual" && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      setFocusIndex(undefined);
      select(index);
      return;
    }
    const target = getTargetIndex(event.key, index, items.length);
    if (target === undefined) return;
    event.preventDefault();
    tabRefs.current[target]?.focus();
    if (activation === "automatic") {
      select(target);
      return;
    }
    setFocusIndex(target);
  }

  const tabId = (index: number) => `${baseId}-tab-${String(index)}`;
  const panelId = (index: number) => `${baseId}-panel-${String(index)}`;
  return (
    <div className={slot("root")}>
      <div role="tablist" aria-label={label} aria-orientation="horizontal" className={slot("list")}>
        {items.map((item, index) => {
          const isSelected = index === selectedIndex;
          const look = unstyled === true ? undefined : isSelected ? SEGMENT_ACTIVE_CLASS : SEGMENT_IDLE_CLASS;
          const className = [look, slot("tab")].filter(Boolean).join(" ");
          return (
            <button
              key={item.id}
              ref={(element) => {
                tabRefs.current[index] = element;
              }}
              type="button"
              role="tab"
              id={tabId(index)}
              aria-selected={isSelected}
              aria-controls={panelId(index)}
              tabIndex={index === stopIndex ? 0 : -1}
              data-tab={item.id}
              onClick={() => {
                setFocusIndex(undefined);
                select(index);
              }}
              onKeyDown={(event) => handleKeyDown(event, index)}
              onBlur={() => setFocusIndex(undefined)}
              className={className === "" ? undefined : className}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      {items.map((item, index) =>
        index === selectedIndex || item.isAlwaysMounted === true ? (
          <div
            key={item.id}
            role="tabpanel"
            id={panelId(index)}
            aria-labelledby={tabId(index)}
            tabIndex={0}
            hidden={index !== selectedIndex}
            data-tab-panel={item.id}
            className={slot("panel")}
          >
            {item.content}
          </div>
        ) : null,
      )}
    </div>
  );
}
