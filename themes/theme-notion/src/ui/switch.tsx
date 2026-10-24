"use client"

import * as React from "react"
import { cn } from "../lib/utils.js"
import { SWITCH_THUMB_SHADOW_CLASS } from "./switch-thumb.js"
import { Switch as SwitchPrimitive } from "radix-ui"

function Switch({
  className,
  size = "default",
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & {
  size?: "sm" | "default"
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        "peer group/switch inline-flex shrink-0 items-center rounded-full border border-transparent transition-all outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 data-[size=default]:h-4 data-[size=default]:w-[26px] data-[size=default]:p-0.5 data-[size=sm]:h-3.5 data-[size=sm]:w-[22px] data-[size=sm]:p-0.5 data-[state=checked]:bg-primary data-[state=unchecked]:bg-control-off",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block rounded-full bg-background ring-0 transition-transform group-data-[size=default]/switch:size-3 group-data-[size=sm]/switch:size-2.5 data-[state=checked]:translate-x-[10px] data-[state=unchecked]:translate-x-0",
          SWITCH_THUMB_SHADOW_CLASS
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
