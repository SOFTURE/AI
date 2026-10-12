import type { StackedBand } from "../scale/stack.js";
import { Area } from "./area.js";
import { seriesSlot } from "./class-names.js";
import type { PathCurve, PlotPoint } from "./geometry.js";

export interface StackedAreasProps {
  /** The bands from `stackSeries`, bottom first. */
  readonly bands: readonly StackedBand[];
  /** The x scale: a data x to viewBox units (`timeScale` or `linearScale`). */
  readonly x: (value: Date | number) => number;
  /** The y scale: a value to viewBox units. */
  readonly y: (value: number) => number;
  readonly curve?: PathCurve;
  /** Fill opacity of every band, 0–1; `--sft-chart-tint-opacity` by default. */
  readonly opacity?: number;
}

/**
 * Stacked bands as `Area`s, each between its lower and upper edge (`areaPath(upper, { baseline: lower })`), bottom
 * first. A band takes its own `slot`, `tone` or `color`, else `seriesSlot(index)`; `data-series` holds its key.
 */
export function StackedAreas({ bands, x, y, curve, opacity }: StackedAreasProps) {
  const toPlot = (points: StackedBand["lower"]): PlotPoint[] => points.map((point) => ({ x: x(point.x), y: y(point.y) }));
  return (
    <>
      {bands.map((band, index) => (
        <Area
          key={band.key}
          data-series={band.key}
          points={toPlot(band.upper)}
          baseline={toPlot(band.lower)}
          {...(curve === undefined ? {} : { curve })}
          {...(opacity === undefined ? {} : { opacity })}
          {...getBandColour(band, index)}
        />
      ))}
    </>
  );
}

/** A band's own colour, else the slot of its position. */
function getBandColour({ slot, tone, color }: StackedBand, index: number): { slot?: number; tone?: StackedBand["tone"]; color?: string } {
  if (color !== undefined) return { color };
  if (slot !== undefined) return { slot };
  if (tone !== undefined) return { tone };
  return { slot: seriesSlot(index) };
}
