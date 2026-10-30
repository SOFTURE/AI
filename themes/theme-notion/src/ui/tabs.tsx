"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "../lib/utils.js"
import { Tabs as TabsPrimitive } from "radix-ui"

type TabsTriggerSize = "default" | "touch"

// A list's size reaches its triggers through context, so a trigger's own size can win over it.
const TabsTriggerSizeContext = React.createContext<TabsTriggerSize>("default")

function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      orientation={orientation}
      className={cn(
        "group/tabs flex gap-2 data-[orientation=horizontal]:flex-col has-data-[scrollable=true]:min-w-0",
        className
      )}
      {...props}
    />
  )
}

const tabsListVariants = cva(
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

// Scrolls a scrollable list so its active trigger sits in the middle, now and whenever the active tab changes.
function useCentredActiveTrigger(list: React.RefObject<HTMLDivElement | null>, isScrollable: boolean) {
  React.useEffect(() => {
    const element = list.current
    if (!isScrollable || element === null) return
    const centreActiveTrigger = () => {
      const active = element.querySelector<HTMLElement>('[data-slot="tabs-trigger"][data-state="active"]')
      if (active === null) return
      element.scrollLeft = active.offsetLeft - (element.clientWidth - active.offsetWidth) / 2
    }
    centreActiveTrigger()
    const observer = new MutationObserver(centreActiveTrigger)
    observer.observe(element, { subtree: true, attributeFilter: ["data-state"] })
    return () => observer.disconnect()
  }, [list, isScrollable])
}

function TabsList({
  className,
  variant = "line",
  size = "default",
  scrollable = false,
  ref,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> &
  VariantProps<typeof tabsListVariants>) {
  const listRef = React.useRef<HTMLDivElement | null>(null)
  const setListRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      listRef.current = node
      if (typeof ref === "function") ref(node)
      else if (ref) ref.current = node
    },
    [ref]
  )
  useCentredActiveTrigger(listRef, scrollable === true)

  return (
    <TabsTriggerSizeContext.Provider value={size ?? "default"}>
      <TabsPrimitive.List
        data-slot="tabs-list"
        data-variant={variant}
        data-scrollable={scrollable === true ? "true" : undefined}
        ref={setListRef}
        className={cn(tabsListVariants({ variant, size, scrollable }), className)}
        {...props}
      />
    </TabsTriggerSizeContext.Provider>
  )
}

function TabsTrigger({
  className,
  size,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger> & {
  size?: TabsTriggerSize
}) {
  const listSize = React.useContext(TabsTriggerSizeContext)

  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-sm font-medium whitespace-nowrap text-muted-foreground transition-all group-data-[orientation=vertical]/tabs:w-full group-data-[orientation=vertical]/tabs:justify-start hover:text-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-1 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 group-data-[variant=default]/tabs-list:data-[state=active]:shadow-sm group-data-[variant=line]/tabs-list:data-[state=active]:shadow-none dark:hover:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        "group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:data-[state=active]:bg-transparent group-data-[variant=line]/tabs-list:data-[state=active]:border-transparent dark:group-data-[variant=line]/tabs-list:data-[state=active]:bg-transparent",
        "bg-clip-padding data-[state=active]:border-input data-[state=active]:bg-background data-[state=active]:text-foreground focus-visible:data-[state=active]:border-ring dark:data-[state=active]:bg-accent/40 dark:data-[state=active]:text-foreground",
        "after:absolute after:bg-foreground after:opacity-0 after:transition-opacity group-data-[orientation=horizontal]/tabs:after:inset-x-0 group-data-[orientation=horizontal]/tabs:after:bottom-[-5px] group-data-[orientation=horizontal]/tabs:after:h-0.5 group-data-[orientation=vertical]/tabs:after:inset-y-0 group-data-[orientation=vertical]/tabs:after:-right-1 group-data-[orientation=vertical]/tabs:after:w-0.5 group-data-[variant=line]/tabs-list:data-[state=active]:after:opacity-100",
        (size ?? listSize) === "touch" && "min-h-touch-target min-w-touch-target",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex-1 outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }
