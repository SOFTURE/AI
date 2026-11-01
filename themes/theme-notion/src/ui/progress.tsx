"use client"

import * as React from "react"
import { cn } from "../lib/utils.js"
import { Progress as ProgressPrimitive } from "radix-ui"

const FILL_CLASS = /(^|\s)bg-/

// Without a value the fill is a third of the track sliding across it for ever (tw-animate-css's exit slide, which
// adds to the `translate` that parks it left of the track); with reduced motion it stands still, full and faint.
const INDETERMINATE_CLASS = [
  "data-[state=indeterminate]:w-1/3",
  "data-[state=indeterminate]:-translate-x-full",
  "data-[state=indeterminate]:animate-out",
  "data-[state=indeterminate]:slide-out-to-right-[400%]",
  "data-[state=indeterminate]:repeat-infinite",
  "data-[state=indeterminate]:duration-1500",
  "data-[state=indeterminate]:ease-in-out",
  "motion-reduce:data-[state=indeterminate]:animate-none",
  "motion-reduce:data-[state=indeterminate]:w-full",
  "motion-reduce:data-[state=indeterminate]:translate-x-0",
  "motion-reduce:data-[state=indeterminate]:opacity-50",
].join(" ")

function hasFillClass(className: string | undefined): boolean {
  return className !== undefined && FILL_CLASS.test(className)
}

function Progress({
  className,
  indicatorClassName,
  value,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root> & {
  /** Classes merged over the indicator's, e.g. another fill colour. */
  indicatorClassName?: string
}) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      value={value}
      className={cn(
        "relative h-1.5 w-full overflow-hidden rounded-full bg-primary/20",
        className
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className={cn(
          "h-full w-full flex-1 bg-primary transition-all",
          INDETERMINATE_CLASS,
          // In dark the default fill is the lighter link blue, so it reaches 3:1 against its track; a fill colour of
          // the caller's own replaces both.
          !hasFillClass(indicatorClassName) && "dark:bg-link",
          indicatorClassName
        )}
        style={value == null ? undefined : { transform: `translateX(-${100 - value}%)` }}
      />
    </ProgressPrimitive.Root>
  )
}

export { Progress }
