// The class builder of TabsList, in a plain module so a Server Component can call it (issue #1008).
import { cva } from "class-variance-authority"

export const tabsListVariants = cva(
  "group/tabs-list inline-flex w-fit items-center justify-center rounded-lg p-[3px] text-muted-foreground group-data-[orientation=horizontal]/tabs:h-9 group-data-[orientation=vertical]/tabs:h-fit group-data-[orientation=vertical]/tabs:flex-col data-[variant=line]:rounded-none",
  {
    variants: {
      variant: {
        default: "bg-muted",
        line: "gap-1 bg-transparent",
      },
      size: {
        default: "",
        // The triggers set the height: a fixed one would cap them at 35 px.
        touch: "group-data-[orientation=horizontal]/tabs:h-auto",
      },
      // Keeps to its container's width and scrolls sideways; the line variant keeps room for the active underline.
      scrollable: {
        false: "",
        true: "relative w-full max-w-full min-w-0 justify-start overflow-x-auto overflow-y-hidden overscroll-x-contain [scrollbar-width:thin] group-data-[orientation=horizontal]/tabs:h-auto data-[variant=line]:pb-1.5 *:flex-none",
      },
    },
    defaultVariants: {
      variant: "line",
      size: "default",
      scrollable: false,
    },
  }
)
