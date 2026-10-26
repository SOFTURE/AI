import {
  SegmentedControl,
  ThemeSwitch,
  type SegmentedControlSlot as UiSegmentedControlSlot,
  type ThemeSwitchSlot as UiThemeSwitchSlot,
} from "@softure-ai/ui";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, expectTypeOf, it } from "vitest";

import {
  SEGMENTED_CONTROL_LOOK,
  SEGMENTED_GROUP_LOOK,
  SEGMENT_ACTIVE_WHEN_CHECKED_LOOK,
  SEGMENT_IDLE_LOOK,
  THEME_SWITCH_LOOK,
  type SegmentedControlSlot,
  type ThemeSwitchSlot,
} from "../src/index.js";

const OPTIONS = [
  { value: "month", label: "Month" },
  { value: "year", label: "Year" },
] as const;

function getClassAttributes(markup: string): string[] {
  return [...markup.matchAll(/class="([^"]*)"/g)].map((match) => match[1] ?? "");
}

describe("segmented control look", () => {
  it("names the same slots as ui's SegmentedControl and ThemeSwitch", () => {
    expectTypeOf<SegmentedControlSlot>().toEqualTypeOf<UiSegmentedControlSlot>();
    expectTypeOf<ThemeSwitchSlot>().toEqualTypeOf<UiThemeSwitchSlot>();
  });

  it("marks the checked segment with surface, strong line and bold as has-checked variants", () => {
    expect(SEGMENT_ACTIVE_WHEN_CHECKED_LOOK).toBe(
      "has-checked:border-line-strong has-checked:bg-surface has-checked:font-semibold has-checked:text-foreground",
    );
  });

  it("fills every slot of the segmented control, with a 2 px accent focus outline", () => {
    expect(SEGMENTED_CONTROL_LOOK).toEqual({
      root: "m-0 min-w-0 border-0 p-0",
      legend: "sr-only",
      options: SEGMENTED_GROUP_LOOK,
      option: `${SEGMENT_IDLE_LOOK} ${SEGMENT_ACTIVE_WHEN_CHECKED_LOOK} has-focus-visible:outline-2 has-focus-visible:outline-offset-1 has-focus-visible:outline-accent`,
      input: "sr-only",
      label: "",
    });
  });

  it("gives the theme switch the segmented control's map", () => {
    expect(THEME_SWITCH_LOOK).toEqual(SEGMENTED_CONTROL_LOOK);
  });

  it("renders ui's SegmentedControl with no lime and none of ui's own classes", () => {
    const markup = renderToStaticMarkup(
      <SegmentedControl options={OPTIONS} value="year" onChange={() => undefined} legend="Period" unstyled classNames={SEGMENTED_CONTROL_LOOK} />,
    );
    const classes = getClassAttributes(markup).flatMap((value) => value.split(" "));
    expect(classes.filter((className) => className.includes("accent-fill") || className.startsWith("sft:"))).toEqual([]);
    expect(markup).toContain(`<label class="${SEGMENTED_CONTROL_LOOK.option}"><input type="radio" class="sr-only"`);
  });

  it("renders ui's ThemeSwitch with no lime and none of ui's own classes", () => {
    const markup = renderToStaticMarkup(<ThemeSwitch unstyled classNames={THEME_SWITCH_LOOK} />);
    const classes = getClassAttributes(markup).flatMap((value) => value.split(" "));
    expect(classes.filter((className) => className.includes("accent-fill") || className.startsWith("sft:"))).toEqual([]);
    expect(markup).toContain(`<legend class="sr-only">`);
  });
});
