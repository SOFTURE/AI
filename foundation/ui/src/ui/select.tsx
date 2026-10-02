"use client";

import type { Locale } from "@softure-ai/core";
import { type KeyboardEvent, useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { type ClassNames, createSlotClassGetter } from "./class-names.js";
import { INPUT_CLASS } from "./field.js";
import { CheckIcon, ChevronDownIcon } from "./icons.js";
import { CLOSED_SELECT, getNextSelectState, type SelectKeyState } from "./select-keys.js";

// A select drawn by the product: a `combobox` button and a `listbox` (WAI-ARIA select-only
// combobox), so the list matches the theme on every platform. Focus stays on the button; the
// highlighted option is `aria-activedescendant`. A hidden input carries the value into form data.
// Ported from FIRE_TRACKER src/components/select.tsx.

export interface SelectOption {
  readonly value: string;
  readonly label: string;
}

export type SelectSlot = "root" | "trigger" | "value" | "chevron" | "list" | "option" | "optionLabel" | "check";

export interface SelectProps {
  readonly options: readonly SelectOption[];
  /** Form field name; without it the select sends nothing. */
  readonly name?: string;
  /** Controlled value. */
  readonly value?: string;
  readonly defaultValue?: string;
  readonly onValueChange?: (value: string) => void;
  readonly id?: string;
  readonly disabled?: boolean;
  /** The name when no `<label for>` names the trigger. */
  readonly "aria-label"?: string;
  readonly "aria-describedby"?: string;
  readonly "aria-invalid"?: boolean;
  /** Locale for matching typed letters with labels; `en` by default. */
  readonly locale?: Locale;
  readonly classNames?: ClassNames<SelectSlot>;
  readonly unstyled?: boolean;
}

const GAP_PX = 4;
const EDGE_PX = 8;
const MAX_LIST_HEIGHT_PX = 256;

export interface ListPlacement {
  readonly left: number;
  readonly top: number;
  readonly minWidth: number;
  readonly maxHeight: number;
}

/**
 * Where the open list stands, in viewport coordinates: below the trigger unless there is more room
 * above, at least as wide as the trigger, never past the right edge, and scrolling inside itself
 * when it is taller than the room (at most 256 px).
 */
export function resolveListPlacement(
  trigger: { top: number; bottom: number; left: number; width: number },
  list: { width: number; height: number },
  viewport: { width: number; height: number },
): ListPlacement {
  const wanted = Math.min(list.height, MAX_LIST_HEIGHT_PX);
  const spaceBelow = viewport.height - trigger.bottom - GAP_PX - EDGE_PX;
  const spaceAbove = trigger.top - GAP_PX - EDGE_PX;
  const isBelow = spaceBelow >= wanted || spaceBelow >= spaceAbove;
  const maxHeight = Math.max(0, Math.min(MAX_LIST_HEIGHT_PX, isBelow ? spaceBelow : spaceAbove));
  const height = Math.min(list.height, maxHeight);
  const width = Math.max(list.width, trigger.width);
  return {
    left: Math.max(EDGE_PX, Math.min(trigger.left, viewport.width - EDGE_PX - width)),
    top: isBelow ? trigger.bottom + GAP_PX : trigger.top - GAP_PX - height,
    minWidth: trigger.width,
    maxHeight,
  };
}

/** A press outside closes the list; the click that follows must not also act on what it lands on. */
function swallowNextClick() {
  function swallow(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    cleanup();
  }
  function cleanup() {
    document.removeEventListener("click", swallow, true);
    document.removeEventListener("pointerdown", cleanup, true);
  }
  document.addEventListener("click", swallow, true);
  document.addEventListener("pointerdown", cleanup, true);
}

const DEFAULT_CLASSES: Readonly<Record<SelectSlot, string>> = {
  root: "sft:relative sft:font-sans",
  trigger: `${INPUT_CLASS} sft:flex sft:items-center sft:pr-9 sft:text-left sft:disabled:cursor-not-allowed sft:disabled:opacity-60 sft:aria-expanded:border-focus`,
  value: "sft:truncate",
  chevron:
    "sft:pointer-events-none sft:absolute sft:right-3 sft:top-1/2 sft:-translate-y-1/2 sft:text-muted sft:transition-[rotate] sft:duration-(--sft-duration-fast) sft:motion-reduce:transition-none",
  list: "sft:z-40 sft:m-0 sft:box-border sft:max-w-[calc(100vw-var(--sft-space-4))] sft:list-none sft:overflow-y-auto sft:overscroll-contain sft:rounded-control sft:border sft:border-border-strong sft:bg-surface-raised sft:p-1 sft:shadow-2",
  option:
    "sft:flex sft:min-h-10 sft:cursor-pointer sft:items-center sft:gap-2 sft:rounded-control sft:px-2.5 sft:text-sm sft:text-foreground sft:data-active:bg-accent/15 sft:aria-selected:font-medium",
  optionLabel: "sft:min-w-0 sft:flex-1",
  check: "sft:shrink-0 sft:text-accent",
};

const CHEVRON_OPEN = "sft:rotate-180";
const CHECK_HIDDEN = "sft:invisible";

/** Picks one option from a list. */
export function Select({
  options,
  name,
  value,
  defaultValue,
  onValueChange,
  id,
  disabled = false,
  "aria-label": ariaLabel,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
  locale = "en",
  classNames,
  unstyled,
}: SelectProps) {
  const generatedId = useId();
  const triggerId = id ?? `${generatedId}-select`;
  const listId = `${generatedId}-list`;
  const getOptionId = (index: number) => `${generatedId}-option-${index}`;
  const isControlled = value !== undefined;
  const [internalValue, setInternalValue] = useState(defaultValue ?? options[0]?.value ?? "");
  const rawValue = isControlled ? value : internalValue;
  // A value outside the options shows and sends the first option, like a native select, so the
  // label and the form data never disagree.
  const foundIndex = options.findIndex((option) => option.value === rawValue);
  const selectedIndex = foundIndex === -1 ? (options.length > 0 ? 0 : -1) : foundIndex;
  const selected = selectedIndex === -1 ? undefined : options[selectedIndex];
  const [keyState, setKeyState] = useState<SelectKeyState>(CLOSED_SELECT);
  const [placement, setPlacement] = useState<ListPlacement | null>(null);
  const [listLabel, setListLabel] = useState<string | undefined>(ariaLabel);
  const isOpen = keyState.isOpen;
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const close = useCallback(() => {
    setKeyState(CLOSED_SELECT);
    setPlacement(null);
  }, []);

  function commit(index: number) {
    const next = options[index];
    if (next === undefined || next.value === rawValue) return;
    if (!isControlled) setInternalValue(next.value);
    onValueChange?.(next.value);
  }

  function openAt(activeIndex: number) {
    if (options.length === 0 || disabled) return;
    setKeyState({ isOpen: true, activeIndex, typeahead: { text: "", at: 0 } });
  }

  const measure = useCallback(() => {
    const trigger = triggerRef.current;
    const list = listRef.current;
    if (!trigger || !list) return;
    const next = resolveListPlacement(
      trigger.getBoundingClientRect(),
      { width: list.offsetWidth, height: list.scrollHeight },
      { width: document.documentElement.clientWidth, height: document.documentElement.clientHeight },
    );
    setPlacement((current) =>
      current !== null &&
      current.left === next.left &&
      current.top === next.top &&
      current.minWidth === next.minWidth &&
      current.maxHeight === next.maxHeight
        ? current
        : next,
    );
  }, []);

  useLayoutEffect(() => {
    if (!isOpen) return;
    measure();
    // The list is named like the field: by `aria-label`, else by the trigger's `<label>`.
    setListLabel(ariaLabel ?? triggerRef.current?.labels?.[0]?.textContent?.trim() ?? undefined);
  }, [isOpen, measure, ariaLabel]);

  useEffect(() => {
    if (!isOpen) return;
    function handlePointerDown(event: PointerEvent) {
      if (event.target instanceof Node && wrapperRef.current?.contains(event.target)) return;
      close();
      swallowNextClick();
    }
    function handleEscape(event: globalThis.KeyboardEvent) {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      // Capture phase and prevented: a modal under the list sees a handled Escape and stays open.
      event.preventDefault();
      close();
    }
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleEscape, true);
    return () => {
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleEscape, true);
    };
  }, [isOpen, measure, close]);

  const isPlaced = placement !== null;
  useEffect(() => {
    if (!isOpen || !isPlaced || keyState.activeIndex < 0) return;
    listRef.current?.querySelector(`[data-index="${keyState.activeIndex}"]`)?.scrollIntoView({ block: "nearest" });
  }, [isOpen, isPlaced, keyState.activeIndex]);

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (disabled || event.altKey || event.ctrlKey || event.metaKey) return;
    const result = getNextSelectState({
      state: keyState,
      key: event.key,
      labels: options.map((option) => option.label),
      selectedIndex,
      now: Date.now(),
      locale,
    });
    if (result.preventDefault) event.preventDefault();
    if (result.commitIndex !== null) commit(result.commitIndex);
    if (result.state.isOpen) setKeyState(result.state);
    else if (isOpen) close();
  }

  const slot = createSlotClassGetter({ defaults: DEFAULT_CLASSES, classNames, unstyled });
  const behaviour = (className: string | undefined, extra: string, isOn: boolean) =>
    isOn && unstyled !== true ? [className, extra].filter((part) => part !== undefined).join(" ") : className;

  return (
    <div ref={wrapperRef} className={slot("root")}>
      {/* A disabled select sends nothing, like a disabled native one. */}
      {name !== undefined && !disabled ? <input type="hidden" name={name} value={selected?.value ?? ""} /> : null}
      <button
        ref={triggerRef}
        type="button"
        id={triggerId}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listId}
        aria-activedescendant={isOpen && keyState.activeIndex >= 0 ? getOptionId(keyState.activeIndex) : undefined}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
        aria-invalid={ariaInvalid}
        disabled={disabled}
        onClick={() => {
          if (isOpen) {
            close();
            return;
          }
          triggerRef.current?.focus();
          openAt(selectedIndex < 0 ? 0 : selectedIndex);
        }}
        onKeyDown={handleKeyDown}
        // Space opens on keydown; its keyup would click the button again and close the list.
        onKeyUp={(event) => {
          if (event.key === " ") event.preventDefault();
        }}
        onBlur={(event) => {
          if (!(event.relatedTarget instanceof Node) || !wrapperRef.current?.contains(event.relatedTarget)) close();
        }}
        className={slot("trigger")}
      >
        <span className={slot("value")}>{selected?.label ?? ""}</span>
      </button>
      <ChevronDownIcon className={behaviour(slot("chevron"), CHEVRON_OPEN, isOpen)} />
      <ul
        ref={listRef}
        id={listId}
        role="listbox"
        tabIndex={-1}
        hidden={!isOpen}
        aria-label={listLabel}
        // Keep focus on the trigger when an option is pressed.
        onPointerDown={(event) => event.preventDefault()}
        onMouseDown={(event) => event.preventDefault()}
        style={
          !isOpen
            ? undefined
            : placement === null
              ? { position: "fixed", left: 0, top: 0, visibility: "hidden" }
              : {
                  position: "fixed",
                  left: `${placement.left}px`,
                  top: `${placement.top}px`,
                  minWidth: `${placement.minWidth}px`,
                  maxHeight: `${placement.maxHeight}px`,
                }
        }
        className={slot("list")}
      >
        {options.map((option, index) => {
          const isSelected = index === selectedIndex;
          const isActive = index === keyState.activeIndex;
          return (
            <li
              key={option.value}
              id={getOptionId(index)}
              role="option"
              aria-selected={isSelected}
              data-value={option.value}
              data-index={index}
              data-active={isActive || undefined}
              onPointerMove={() => {
                if (!isActive) setKeyState((current) => ({ ...current, activeIndex: index }));
              }}
              onClick={() => {
                commit(index);
                close();
              }}
              className={slot("option")}
            >
              <span className={slot("optionLabel")}>{option.label}</span>
              <CheckIcon className={behaviour(slot("check"), CHECK_HIDDEN, !isSelected)} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
