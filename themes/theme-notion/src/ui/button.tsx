import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "../lib/utils.js"
import { Slot } from "radix-ui"

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-all outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary-hover",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:hover:bg-destructive/50 dark:focus-visible:ring-destructive/40",
        outline:
          "border border-border bg-background hover:bg-linear-to-r hover:from-accent hover:to-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-accent-strong",
        ghost: "text-muted-foreground hover:bg-accent hover:text-foreground",
        link: "text-link underline-offset-4 hover:underline",
        floating:
          "bg-background text-foreground shadow-menu hover:bg-linear-to-r hover:from-accent hover:to-accent aria-expanded:bg-linear-to-r aria-expanded:from-accent-strong aria-expanded:to-accent-strong disabled:text-muted-foreground disabled:opacity-100 disabled:shadow-none",
      },
      size: {
        default:
          "h-7 px-2.5 has-[>svg:first-child]:pl-2 has-[>svg:last-child]:pr-2",
        xs: "h-6 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-6 gap-1 rounded-md px-2 text-[13px] has-[>svg:first-child]:pl-1.5 has-[>svg:last-child]:pr-1.5",
        lg: "h-8 rounded-md px-3 has-[>svg:first-child]:pl-2.5 has-[>svg:last-child]:pr-2.5",
        icon: "size-7",
        "icon-xs": "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-6",
        "icon-lg": "size-8",
        touch:
          "h-touch-target px-3 has-[>svg:first-child]:pl-2.5 has-[>svg:last-child]:pr-2.5",
        "icon-touch": "size-touch-target",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
