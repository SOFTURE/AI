"use client"

import * as React from "react"
import { cn } from "../lib/utils.js"
import { Progress as ProgressPrimitive } from "radix-ui"

const FILL_CLASS = /(^|\s)bg-/

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
          // In dark the default fill is the lighter link blue, so it reaches 3:1 against its track; a fill colour of
          // the caller's own replaces both.
          !hasFillClass(indicatorClassName) && "dark:bg-link",
          indicatorClassName
        )}
        style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
      />
    </ProgressPrimitive.Root>
  )
}

export { Progress }
