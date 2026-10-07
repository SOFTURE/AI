import type { TimeTick } from "./axis-ticks.js";
import { cx } from "./class-names.js";
import { percent } from "./geometry.js";

/**
 * Horizontal-axis labels in HTML under the plot, at percentages of its width: `start` runs right from its
 * position, `end` up to it, `center` centres on it. `minor` labels are hidden on narrow screens; a `sublabel`
 * is a second row under its label. The parent places the row; hidden from assistive technology like the
 * drawing it labels.
 */
export function TimeAxis({ ticks, className }: { readonly ticks: readonly TimeTick[]; readonly className?: string }) {
  const hasSublabels = ticks.some((tick) => tick.sublabel !== undefined);
  return (
    <div aria-hidden="true" className={cx("sft-chart-time-axis", hasSublabels && "sft-chart-time-axis-two-rows", className)}>
      {ticks.map((tick) => (
        <span
          key={tick.key}
          className={cx("sft-chart-time-label", `sft-chart-align-${tick.align}`, tick.minor === true && "sft-chart-minor")}
          style={{ left: percent(tick.xPercent) }}
        >
          {tick.label}
          {tick.sublabel !== undefined && <span className="sft-chart-time-sublabel">{tick.sublabel}</span>}
        </span>
      ))}
    </div>
  );
}
