import type { TimeTick } from "./axis-ticks.js";
import { cx } from "./class-names.js";
import { percent } from "./geometry.js";

/**
 * Time labels in HTML under the plot, at percentages of its width: `start` runs right from its
 * position, `end` up to it, `center` centres on it. `minor` labels are hidden on narrow screens. The
 * parent places the row; hidden from assistive technology like the drawing it labels.
 */
export function TimeAxis({ ticks, className }: { readonly ticks: readonly TimeTick[]; readonly className?: string }) {
  return (
    <div aria-hidden="true" className={cx("sft-chart-time-axis", className)}>
      {ticks.map((tick) => (
        <span
          key={tick.key}
          className={cx("sft-chart-time-label", `sft-chart-align-${tick.align}`, tick.minor === true && "sft-chart-minor")}
          style={{ left: percent(tick.xPercent) }}
        >
          {tick.label}
        </span>
      ))}
    </div>
  );
}
