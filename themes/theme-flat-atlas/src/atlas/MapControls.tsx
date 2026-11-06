import { Minus, Plus, RotateCcw, type LucideIcon } from "lucide-react";

import { cn } from "../lib/utils.js";

import { ATLAS_ICON_STROKE_WIDTH } from "./icons.js";

/** How the controls stack: one column at the map's edge (default) or one row under it on a phone. */
export type MapControlsOrientation = "vertical" | "horizontal";

export interface MapControlsProps {
  /** The group's accessible name, e.g. "Map zoom". */
  readonly label: string;
  readonly zoomInLabel: string;
  readonly zoomOutLabel: string;
  /** The reset button's name; leave `onReset` out to drop the button. */
  readonly resetLabel?: string;
  readonly onZoomIn: () => void;
  readonly onZoomOut: () => void;
  readonly onReset?: () => void;
  /** True at the closest zoom: the plus button is disabled. */
  readonly isAtMaxZoom?: boolean;
  /** True at the widest zoom: the minus button is disabled. */
  readonly isAtMinZoom?: boolean;
  /** True when the map is in its first view: the reset button is disabled. */
  readonly isAtStart?: boolean;
  readonly orientation?: MapControlsOrientation;
  readonly className?: string;
}

/** One flat paper bar: no gaps between the buttons, a hairline between them, the outline round the whole group. */
const GROUP_LOOK = "inline-flex overflow-hidden rounded-control border border-line-strong bg-surface-raised text-foreground";

const ORIENTATION_LOOK: Readonly<Record<MapControlsOrientation, string>> = {
  vertical: "flex-col divide-y divide-border",
  horizontal: "flex-row divide-x divide-border",
};

/** Each button is a 40 px touch target with an 18 px icon; hover tints it with ink, focus draws the stamp outline inside. */
const CONTROL_LOOK =
  "inline-flex size-touch cursor-pointer items-center justify-center bg-transparent text-foreground transition-colors hover:not-disabled:bg-foreground/7 active:not-disabled:bg-foreground/12 focus-visible:relative focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:text-muted disabled:opacity-50 [&_svg]:size-4.5";

interface ControlProps {
  readonly icon: LucideIcon;
  readonly label: string;
  readonly onClick: () => void;
  readonly isDisabled: boolean;
  readonly control: "zoom-in" | "zoom-out" | "reset";
}

function MapControl({ icon: Icon, label, onClick, isDisabled, control }: ControlProps) {
  return (
    <button type="button" data-control={control} aria-label={label} title={label} disabled={isDisabled} onClick={onClick} className={CONTROL_LOOK}>
      <Icon aria-hidden="true" strokeWidth={ATLAS_ICON_STROKE_WIDTH} />
    </button>
  );
}

/**
 * The map's zoom controls: plus, minus and an optional reset to the first view, as one bar laid over the map's
 * corner. The map owns the zoom; the bar only calls back and shows the limits as disabled buttons.
 */
export function MapControls({
  label,
  zoomInLabel,
  zoomOutLabel,
  resetLabel,
  onZoomIn,
  onZoomOut,
  onReset,
  isAtMaxZoom = false,
  isAtMinZoom = false,
  isAtStart = false,
  orientation = "vertical",
  className,
}: MapControlsProps) {
  return (
    <div role="group" aria-label={label} data-slot="map-controls" data-orientation={orientation} className={cn(GROUP_LOOK, ORIENTATION_LOOK[orientation], className)}>
      <MapControl control="zoom-in" icon={Plus} label={zoomInLabel} onClick={onZoomIn} isDisabled={isAtMaxZoom} />
      <MapControl control="zoom-out" icon={Minus} label={zoomOutLabel} onClick={onZoomOut} isDisabled={isAtMinZoom} />
      {onReset === undefined || resetLabel === undefined ? null : (
        <MapControl control="reset" icon={RotateCcw} label={resetLabel} onClick={onReset} isDisabled={isAtStart} />
      )}
    </div>
  );
}
