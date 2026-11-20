"use client"

import * as React from "react"
import { cn } from "../lib/utils.js"
import { SWITCH_THUMB_SHADOW_CLASS } from "./switch-thumb.js"
import { Switch as SwitchPrimitive } from "radix-ui"

// The touch size: the root is the touch target (44 × 44) and draws the same 26 × 16 track inside it, so a phone taps
// the whole square; negative margins keep the switch's place in the layout at the track's size.
const TOUCH_ROOT_CLASS =
  "relative -mx-[calc((var(--spacing-touch-target)-26px)/2)] -my-[calc((var(--spacing-touch-target)-16px)/2)] size-touch-target justify-center data-[state=checked]:bg-transparent data-[state=unchecked]:bg-transparent focus-visible:ring-0 before:absolute before:top-1/2 before:left-1/2 before:h-4 before:w-[26px] before:-translate-x-1/2 before:-translate-y-1/2 before:rounded-full before:transition-all data-[state=checked]:before:bg-primary data-[state=unchecked]:before:bg-control-off focus-visible:before:ring-2 focus-visible:before:ring-ring"
// The thumb sits centred in the square, so it moves 5 px either side of the centre: the track's 2 px inset at each end.
const TOUCH_THUMB_CLASS = "relative size-3 data-[state=checked]:translate-x-[5px] data-[state=unchecked]:-translate-x-[5px]"

function Switch({
  className,
  size = "default",
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & {
  size?: "sm" | "default" | "touch"
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        "peer group/switch inline-flex shrink-0 items-center rounded-full border border-transparent transition-all outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 data-[size=default]:h-4 data-[size=default]:w-[26px] data-[size=default]:p-0.5 data-[size=sm]:h-3.5 data-[size=sm]:w-[22px] data-[size=sm]:p-0.5 data-[state=checked]:bg-primary data-[state=unchecked]:bg-control-off",
        size === "touch" && TOUCH_ROOT_CLASS,
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block rounded-full bg-background ring-0 transition-transform group-data-[size=default]/switch:size-3 group-data-[size=sm]/switch:size-2.5 data-[state=checked]:translate-x-[10px] data-[state=unchecked]:translate-x-0",
          SWITCH_THUMB_SHADOW_CLASS,
          size === "touch" && TOUCH_THUMB_CLASS
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
