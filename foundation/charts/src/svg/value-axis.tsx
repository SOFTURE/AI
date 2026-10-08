import type { ValueTick } from "./axis-ticks.js";
import { cx } from "./class-names.js";
import { percent } from "./geometry.js";

/** At this many labels or more, every other one is `minor` (hidden on narrow screens). */
const THIN_FROM = 4;

/**
 * Whether the label at `index` of `count` is hidden on narrow screens. Counted from the top, so the
 * highest label always stays and, with five labels from zero, so do zero and the middle (counted
 * from the bottom, a phone would lose the top value).
 */
export function isMinorValueTick(index: number, count: number): boolean {
  return count >= THIN_FROM && (count - 1 - index) % 2 === 1;
}

/**
 * Which labels stay on narrow screens: `alternate` (the default) hides every other one from four labels
 * (`isMinorValueTick`), `all` hides none, for a small chart with few short labels.
 */
export type ValueAxisNarrow = "alternate" | "all";

export interface ValueAxisProps {
  readonly ticks: readonly ValueTick[];
  readonly narrow?: ValueAxisNarrow;
  readonly className?: string;
}

/**
 * Value labels in HTML at heights of the plot, beside it. The parent places the column (a class with
 * its position): the axis sets none of its own, or it would fight the parent's.
 * Hidden from assistive technology like the drawing it labels.
 */
export function ValueAxis({ ticks, narrow = "alternate", className }: ValueAxisProps) {
  return (
    <div aria-hidden="true" className={cx("sft-chart-value-axis", className)}>
      {ticks.map((tick, index) => (
        <span
          key={tick.key}
          className={cx("sft-chart-value-label", narrow === "alternate" && isMinorValueTick(index, ticks.length) && "sft-chart-minor")}
          style={{ bottom: percent(tick.fromBottomPercent) }}
        >
          {tick.label}
        </span>
      ))}
    </div>
  );
}
