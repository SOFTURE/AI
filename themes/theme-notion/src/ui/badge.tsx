import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "../lib/utils.js"
import { Slot } from "radix-ui"

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a&]:hover:bg-primary/90",
        secondary:
          "bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90",
        destructive:
          "bg-destructive text-destructive-foreground focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:focus-visible:ring-destructive/40 [a&]:hover:bg-destructive/90",
        outline:
          "border-border text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        ghost: "[a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        link: "text-primary underline-offset-4 [a&]:hover:underline",
        tag: "h-5 rounded-xs px-1.5 py-0 text-sm font-normal",
      },
      color: {
        none: "",
        default: "bg-default-tag text-default-tag-foreground",
        gray: "bg-gray-tag text-gray-tag-foreground",
        brown: "bg-brown-tag text-brown-tag-foreground",
        orange: "bg-orange-tag text-orange-tag-foreground",
        yellow: "bg-yellow-tag text-yellow-tag-foreground",
        green: "bg-green-tag text-green-tag-foreground",
        blue: "bg-blue-tag text-blue-tag-foreground",
        purple: "bg-purple-tag text-purple-tag-foreground",
        pink: "bg-pink-tag text-pink-tag-foreground",
        red: "bg-red-tag text-red-tag-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
      color: "none",
    },
  }
)

function Badge({
  className,
  variant = "default",
  color,
  asChild = false,
  ...props
}: Omit<React.ComponentProps<"span">, "color"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant, color }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
