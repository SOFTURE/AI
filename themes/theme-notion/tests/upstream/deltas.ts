import type { UiDelta } from "./guard.js";

/**
 * The package's intended differences from the pinned shadcn new-york v4 sources (`source.json`), per file in `src/ui`
 * and in file order. A change to a ui file that is not listed here fails `tests/upstream.test.ts`: list it with its
 * reason in the same change, so review sees the delta from upstream, not only the new class string.
 */
export const UI_DELTAS: Readonly<Record<string, readonly UiDelta[]>> = {
  "accordion": [
    {
      reason: "imports: relative paths with `.js` under NodeNext, `cn` from the theme",
      upstream: "import { cn } from \"cn\"",
      ours: "import { cn } from \"../lib/utils.js\"",
    },
    {
      reason: "focus: `ring-2 ring-ring` instead of `ring-[3px] ring-ring/50`",
      upstream: "          \"flex flex-1 items-start justify-between gap-4 rounded-md py-4 text-left text-sm font-medium transition-all outline-none hover:underline focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 [&[data-state=open]>svg]:rotate-180\",",
      ours: "          \"flex flex-1 items-start justify-between gap-4 rounded-md py-4 text-left text-sm font-medium transition-all outline-none hover:underline focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&[data-state=open]>svg]:rotate-180\",",
    },
  ],
  "alert-dialog": [
    {
      reason: "imports: relative paths with `.js` under NodeNext, `cn` from the theme",
      upstream: "import { cn } from \"cn\"",
      ours: "import { cn } from \"../lib/utils.js\"",
    },
    {
      reason: "imports: relative paths with `.js` under NodeNext, `cn` from the theme",
      upstream: "import { Button } from \"@/registry/new-york-v4/ui/button\"",
      ours: "import { Button } from \"./button.js\"",
    },
    {
      reason: "overlay: the `overlay` token instead of `bg-black/50`",
      upstream: "        \"fixed inset-0 z-50 bg-black/50 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0\",",
      ours: "        \"fixed inset-0 z-50 bg-overlay data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0\",",
    },
    {
      reason: "dialog: radius 10 and `shadow-dialog`, no border",
      upstream: "          \"group/alert-dialog-content fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border bg-background p-6 shadow-lg duration-200 data-[size=sm]:max-w-xs data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[size=default]:sm:max-w-lg\",",
      ours: "          \"group/alert-dialog-content fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-xl bg-background p-6 shadow-dialog duration-200 data-[size=sm]:max-w-xs data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[size=default]:sm:max-w-lg\",",
    },
  ],
  "alert": [
    {
      reason: "imports: relative paths with `.js` under NodeNext, `cn` from the theme",
      upstream: "import { cn } from \"cn\"",
      ours: "import { cn } from \"../lib/utils.js\"",
    },
    {
      reason: "alert: palette colour variants (a Notion callout); the destructive description in full `destructive` (WCAG AA contrast)",
      upstream: "          \"bg-card text-destructive *:data-[slot=alert-description]:text-destructive/90 [&>svg]:text-current\",",
      ours: "          \"bg-card text-destructive *:data-[slot=alert-description]:text-destructive [&>svg]:text-current\",\n        gray: \"border-transparent bg-gray-bg text-foreground [&>svg]:text-gray *:data-[slot=alert-description]:text-foreground\",\n        brown: \"border-transparent bg-brown-bg text-foreground [&>svg]:text-brown *:data-[slot=alert-description]:text-foreground\",\n        orange: \"border-transparent bg-orange-bg text-foreground [&>svg]:text-orange *:data-[slot=alert-description]:text-foreground\",\n        yellow: \"border-transparent bg-yellow-bg text-foreground [&>svg]:text-yellow *:data-[slot=alert-description]:text-foreground\",\n        green: \"border-transparent bg-green-bg text-foreground [&>svg]:text-green *:data-[slot=alert-description]:text-foreground\",\n        blue: \"border-transparent bg-blue-bg text-foreground [&>svg]:text-blue *:data-[slot=alert-description]:text-foreground\",\n        purple: \"border-transparent bg-purple-bg text-foreground [&>svg]:text-purple *:data-[slot=alert-description]:text-foreground\",\n        pink: \"border-transparent bg-pink-bg text-foreground [&>svg]:text-pink *:data-[slot=alert-description]:text-foreground\",\n        red: \"border-transparent bg-red-bg text-foreground [&>svg]:text-red *:data-[slot=alert-description]:text-foreground\",",
    },
  ],
  "avatar": [
    {
      reason: "imports: relative paths with `.js` under NodeNext, `cn` from the theme",
      upstream: "import { cn } from \"cn\"",
      ours: "import { cn } from \"../lib/utils.js\"",
    },
  ],
  "badge": [
    {
      reason: "imports: relative paths with `.js` under NodeNext, `cn` from the theme",
      upstream: "import { cn } from \"cn\"",
      ours: "import { cn } from \"../lib/utils.js\"",
    },
    {
      reason: "imports: relative paths with `.js`; the palette tag classes and the variants a colour applies to",
      upstream: "import { Slot } from \"radix-ui\"\n",
      ours: "import { Slot } from \"radix-ui\"\n\nconst TAG_COLORS = {\n  default: \"bg-default-tag text-default-tag-foreground\",\n  gray: \"bg-gray-tag text-gray-tag-foreground\",\n  brown: \"bg-brown-tag text-brown-tag-foreground\",\n  orange: \"bg-orange-tag text-orange-tag-foreground\",\n  yellow: \"bg-yellow-tag text-yellow-tag-foreground\",\n  green: \"bg-green-tag text-green-tag-foreground\",\n  blue: \"bg-blue-tag text-blue-tag-foreground\",\n  purple: \"bg-purple-tag text-purple-tag-foreground\",\n  pink: \"bg-pink-tag text-pink-tag-foreground\",\n  red: \"bg-red-tag text-red-tag-foreground\",\n}\n\n// Every variant a palette colour applies to: all but destructive.\nconst COLORED_VARIANTS = [\"default\", \"secondary\", \"outline\", \"ghost\", \"link\", \"tag\"] as const\n",
    },
    {
      reason: "focus: `ring-2 ring-ring` instead of `ring-[3px] ring-ring/50`",
      upstream: "  \"inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3\",",
      ours: "  \"inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3\",",
    },
    {
      reason: "badge: default hovers on `primary-hover` (WCAG AA contrast)",
      upstream: "        default: \"bg-primary text-primary-foreground [a&]:hover:bg-primary/90\",",
      ours: "        default: \"bg-primary text-primary-foreground [a&]:hover:bg-primary-hover\",",
    },
    {
      reason: "badge: `destructive-foreground` text (the theme clears Tailwind's `white`), dark hover `destructive/50` like Button",
      upstream: "          \"bg-destructive text-white focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:focus-visible:ring-destructive/40 [a&]:hover:bg-destructive/90\",",
      ours: "          \"bg-destructive text-destructive-foreground focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:focus-visible:ring-destructive/40 [a&]:hover:bg-destructive/90 dark:[a&]:hover:bg-destructive/50\",",
    },
    {
      reason: "badge: links in `text-link` (WCAG AA contrast); the `tag` variant (20 px, radius 3); `color` values live in compound variants",
      upstream: "        link: \"text-primary underline-offset-4 [a&]:hover:underline\",",
      ours: "        link: \"text-link underline-offset-4 [a&]:hover:underline\",\n        tag: \"h-5 rounded-xs px-1.5 py-0 text-sm font-normal\",\n      },\n      color: {\n        none: \"\",\n        default: \"\",\n        gray: \"\",\n        brown: \"\",\n        orange: \"\",\n        yellow: \"\",\n        green: \"\",\n        blue: \"\",\n        purple: \"\",\n        pink: \"\",\n        red: \"\",",
    },
    {
      reason: "badge: a palette colour applies to every variant but destructive, which keeps its own fill and text (WCAG AA contrast)",
      upstream: "      },\n    },",
      ours: "      },\n    },\n    // A destructive badge keeps its own fill and text whatever its colour.\n    compoundVariants: Object.entries(TAG_COLORS).map(([color, className]) => ({\n      variant: [...COLORED_VARIANTS],\n      color: color as keyof typeof TAG_COLORS,\n      className,\n    })),",
    },
    {
      reason: "badge: `color` defaults to none",
      upstream: "      variant: \"default\",",
      ours: "      variant: \"default\",\n      color: \"none\",",
    },
    {
      reason: "badge: the `color` prop",
      upstream: "  variant = \"default\",",
      ours: "  variant = \"default\",\n  color,",
    },
    {
      reason: "badge: `color` is the variant, not the HTML attribute",
      upstream: "}: React.ComponentProps<\"span\"> &",
      ours: "}: Omit<React.ComponentProps<\"span\">, \"color\"> &",
    },
    {
      reason: "badge: the `color` prop reaches the variants",
      upstream: "      className={cn(badgeVariants({ variant }), className)}",
      ours: "      className={cn(badgeVariants({ variant, color }), className)}",
    },
  ],
  "breadcrumb": [
    {
      reason: "imports: relative paths with `.js` under NodeNext, `cn` from the theme",
      upstream: "import { cn } from \"cn\"",
      ours: "import { en as messages } from \"../messages/en.js\"\nimport { cn } from \"../lib/utils.js\"",
    },
    {
      reason: "copy: built-in English text from the message layer, overridable by a prop",
      upstream: "  return <nav aria-label=\"breadcrumb\" data-slot=\"breadcrumb\" {...props} />",
      ours: "  return <nav aria-label={messages.breadcrumb.label} data-slot=\"breadcrumb\" {...props} />",
    },
    {
      reason: "copy: built-in English text from the message layer, overridable by a prop",
      upstream: "function BreadcrumbEllipsis({\n  className,",
      ours: "function BreadcrumbEllipsis({\n  className,\n  label = messages.breadcrumb.more,",
    },
    {
      reason: "copy: built-in English text from the message layer, overridable by a prop",
      upstream: "  ...props\n}: React.ComponentProps<\"span\">) {",
      ours: "  ...props\n}: React.ComponentProps<\"span\"> & {\n  // The hidden \"more\" text, from the app's message layer.\n  label?: string\n}) {",
    },
    {
      reason: "copy: built-in English text from the message layer, overridable by a prop",
      upstream: "      <span className=\"sr-only\">More</span>",
      ours: "      <span className=\"sr-only\">{label}</span>",
    },
  ],
  "button-group": [
    {
      reason: "imports: relative paths with `.js` under NodeNext, `cn` from the theme",
      upstream: "import { cn } from \"cn\"",
      ours: "import { cn } from \"../lib/utils.js\"",
    },
    {
      reason: "imports: relative paths with `.js` under NodeNext, `cn` from the theme",
      upstream: "import { Separator } from \"@/registry/new-york-v4/ui/separator\"",
      ours: "import { Separator } from \"./separator.js\"",
    },
    {
      reason: "button group: no shadows",
      upstream: "        \"flex items-center gap-2 rounded-md border bg-muted px-4 text-sm font-medium shadow-xs [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4\",",
      ours: "        \"flex items-center gap-2 rounded-md border bg-muted px-4 text-sm font-medium [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4\",",
    },
    {
      reason: "button group: the separator in `border` (WCAG 1.4.11 non-text contrast)",
      upstream: "        \"relative m-0! self-stretch bg-input data-[orientation=vertical]:h-auto\",",
      ours: "        \"relative m-0! self-stretch bg-border data-[orientation=vertical]:h-auto\",",
    },
  ],
  "button": [
    {
      reason: "imports: relative paths with `.js` under NodeNext, `cn` from the theme",
      upstream: "import { cn } from \"cn\"",
      ours: "import { cn } from \"../lib/utils.js\"",
    },
    {
      reason: "button: tighter gap, the theme's focus ring",
      upstream: "  \"inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-all outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4\",",
      ours: "  \"inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-all outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4\",",
    },
    {
      reason: "button: the `primary-hover` token",
      upstream: "        default: \"bg-primary text-primary-foreground hover:bg-primary/90\",",
      ours: "        default: \"bg-primary text-primary-foreground hover:bg-primary-hover\",",
    },
    {
      reason: "button: the `destructive-foreground` token, dark hover `destructive/50` (WCAG AA contrast)",
      upstream: "          \"bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:focus-visible:ring-destructive/40\",",
      ours: "          \"bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:hover:bg-destructive/50 dark:focus-visible:ring-destructive/40\",",
    },
    {
      reason: "button: thin `border` outline, no shadows, `secondary` hover `accent-strong`, the Notion ghost, links in `text-link`",
      upstream: "          \"border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50\",\n        secondary:\n          \"bg-secondary text-secondary-foreground hover:bg-secondary/80\",\n        ghost:\n          \"hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50\",\n        link: \"text-primary underline-offset-4 hover:underline\",",
      ours: "          \"border border-border bg-background hover:bg-accent hover:text-accent-foreground\",\n        secondary: \"bg-secondary text-secondary-foreground hover:bg-accent-strong\",\n        ghost: \"text-muted-foreground hover:bg-accent hover:text-foreground\",\n        link: \"text-link underline-offset-4 hover:underline\",",
    },
    {
      reason: "button: 28 px, a smaller padding on the icon side",
      upstream: "        default: \"h-9 px-4 py-2 has-[>svg]:px-3\",",
      ours: "        default:\n          \"h-7 px-2.5 has-[>svg:first-child]:pl-2 has-[>svg:last-child]:pr-2\",",
    },
    {
      reason: "button: sizes 24/32 px and the icon sizes",
      upstream: "        sm: \"h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5\",\n        lg: \"h-10 rounded-md px-6 has-[>svg]:px-4\",\n        icon: \"size-9\",",
      ours: "        sm: \"h-6 gap-1 rounded-md px-2 text-[13px] has-[>svg:first-child]:pl-1.5 has-[>svg:last-child]:pr-1.5\",\n        lg: \"h-8 rounded-md px-3 has-[>svg:first-child]:pl-2.5 has-[>svg:last-child]:pr-2.5\",\n        icon: \"size-7\",",
    },
    {
      reason: "button: the icon sizes 24/32 px",
      upstream: "        \"icon-sm\": \"size-8\",\n        \"icon-lg\": \"size-10\",",
      ours: "        \"icon-sm\": \"size-6\",\n        \"icon-lg\": \"size-8\",",
    },
  ],
  "card": [
    {
      reason: "imports: relative paths with `.js` under NodeNext, `cn` from the theme",
      upstream: "import { cn } from \"cn\"",
      ours: "import { cn } from \"../lib/utils.js\"",
    },
    {
      reason: "card: radius 8 and `shadow-card` instead of a border",
      upstream: "        \"flex flex-col gap-6 rounded-xl border bg-card py-6 text-card-foreground shadow-sm\",",
      ours: "        \"flex flex-col gap-6 rounded-lg bg-card py-6 text-card-foreground shadow-card\",",
    },
  ],
  "checkbox": [
    {
      reason: "imports: relative paths with `.js` under NodeNext, `cn` from the theme",
      upstream: "import { cn } from \"cn\"",
      ours: "import { cn } from \"../lib/utils.js\"",
    },
    {
      reason: "checkbox: 16 px, radius 3, a 1.5 px `muted-foreground` border, the theme's focus ring",
      upstream: "        \"peer size-4 shrink-0 rounded-[4px] border border-input shadow-xs transition-shadow outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground dark:bg-input/30 dark:aria-invalid:ring-destructive/40 dark:data-[state=checked]:bg-primary\",",
      ours: "        \"peer size-4 shrink-0 rounded-xs border-[1.5px] border-muted-foreground transition-shadow outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground dark:aria-invalid:ring-destructive/40 dark:data-[state=checked]:bg-primary\",",
    },
  ],
  "collapsible": [
  ],
  "command": [
    {
      reason: "imports: relative paths with `.js` under NodeNext, `cn` from the theme",
      upstream: "import { cn } from \"cn\"",
      ours: "import { en as messages } from \"../messages/en.js\"\nimport { cn } from \"../lib/utils.js\"",
    },
    {
      reason: "imports: relative paths with `.js` under NodeNext, `cn` from the theme",
      upstream: "} from \"@/registry/new-york-v4/ui/dialog\"",
      ours: "} from \"./dialog.js\"",
    },
    {
      reason: "copy: built-in English text from the message layer, overridable by a prop",
      upstream: "  title = \"Command Palette\",\n  description = \"Search for a command to run...\",",
      ours: "  title = messages.command.title,\n  description = messages.command.description,",
    },
    {
      reason: "menu item: radius 6, at least 28 px high",
      upstream: "        \"relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground\",",
      ours: "        \"relative flex cursor-default items-center gap-2 rounded-md min-h-7 px-2 py-1 text-sm outline-hidden select-none data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground\",",
    },
  ],
  "dialog": [
    {
      reason: "imports: relative paths with `.js` under NodeNext, `cn` from the theme",
      upstream: "import { cn } from \"cn\"",
      ours: "import { en as messages } from \"../messages/en.js\"\nimport { cn } from \"../lib/utils.js\"",
    },
    {
      reason: "imports: relative paths with `.js` under NodeNext, `cn` from the theme",
      upstream: "import { Button } from \"@/registry/new-york-v4/ui/button\"",
      ours: "import { Button } from \"./button.js\"",
    },
    {
      reason: "overlay: the `overlay` token instead of `bg-black/50`",
      upstream: "        \"fixed inset-0 z-50 bg-black/50 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0\",",
      ours: "        \"fixed inset-0 z-50 bg-overlay data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0\",",
    },
    {
      reason: "copy: built-in English text from the message layer, overridable by a prop",
      upstream: "  showCloseButton = true,",
      ours: "  showCloseButton = true,\n  closeLabel = messages.dialog.close,",
    },
    {
      reason: "copy: built-in English text from the message layer, overridable by a prop",
      upstream: "}: React.ComponentProps<typeof DialogPrimitive.Content> & {\n  showCloseButton?: boolean",
      ours: "}: React.ComponentProps<typeof DialogPrimitive.Content> & {\n  showCloseButton?: boolean\n  // The close button's hidden text, from the app's message layer.\n  closeLabel?: string",
    },
    {
      reason: "dialog: radius 10 and `shadow-dialog`, no border",
      upstream: "          \"fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border bg-background p-6 shadow-lg duration-200 outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 sm:max-w-lg\",",
      ours: "          \"fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-xl bg-background p-6 shadow-dialog duration-200 outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 sm:max-w-lg\",",
    },
    {
      reason: "copy: built-in English text from the message layer, overridable by a prop",
      upstream: "            <span className=\"sr-only\">Close</span>",
      ours: "            <span className=\"sr-only\">{closeLabel}</span>",
    },
  ],
  "dropdown-menu": [
    {
      reason: "imports: relative paths with `.js` under NodeNext, `cn` from the theme",
      upstream: "import { cn } from \"cn\"",
      ours: "import { cn } from \"../lib/utils.js\"",
    },
    {
      reason: "menu: radius 10 and `shadow-menu`, no border",
      upstream: "          \"z-50 max-h-(--radix-dropdown-menu-content-available-height) min-w-[8rem] origin-(--radix-dropdown-menu-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95\",",
      ours: "          \"z-50 max-h-(--radix-dropdown-menu-content-available-height) min-w-[8rem] origin-(--radix-dropdown-menu-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-xl bg-popover p-1 text-popover-foreground shadow-menu data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95\",",
    },
    {
      reason: "menu item: radius 6, at least 28 px high; a focused destructive item in dark is tinted `destructive/10` (WCAG AA contrast)",
      upstream: "        \"relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[inset]:pl-8 data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 data-[variant=destructive]:focus:text-destructive dark:data-[variant=destructive]:focus:bg-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground data-[variant=destructive]:*:[svg]:text-destructive!\",",
      ours: "        \"relative flex cursor-default items-center gap-2 rounded-md min-h-7 px-2 py-1 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[inset]:pl-8 data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 data-[variant=destructive]:focus:text-destructive dark:data-[variant=destructive]:focus:bg-destructive/10 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground data-[variant=destructive]:*:[svg]:text-destructive!\",",
    },
    {
      reason: "menu item: radius 6, at least 28 px high",
      upstream: "      data-slot=\"dropdown-menu-checkbox-item\"\n      className={cn(\n        \"relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4\",",
      ours: "      data-slot=\"dropdown-menu-checkbox-item\"\n      className={cn(\n        \"relative flex cursor-default items-center gap-2 rounded-md min-h-7 py-1 pr-2 pl-8 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4\",",
    },
    {
      reason: "menu item: radius 6, at least 28 px high",
      upstream: "      data-slot=\"dropdown-menu-radio-item\"\n      className={cn(\n        \"relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4\",",
      ours: "      data-slot=\"dropdown-menu-radio-item\"\n      className={cn(\n        \"relative flex cursor-default items-center gap-2 rounded-md min-h-7 py-1 pr-2 pl-8 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4\",",
    },
    {
      reason: "menu shortcut: small muted text",
      upstream: "        \"px-2 py-1.5 text-sm font-medium data-[inset]:pl-8\",",
      ours: "        \"px-2 py-1.5 text-xs font-medium text-muted-foreground data-[inset]:pl-8\",",
    },
    {
      reason: "menu item: radius 6, at least 28 px high",
      upstream: "        \"flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-[inset]:pl-8 data-[state=open]:bg-accent data-[state=open]:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground\",",
      ours: "        \"flex cursor-default items-center gap-2 rounded-md min-h-7 px-2 py-1 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-[inset]:pl-8 data-[state=open]:bg-accent data-[state=open]:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground\",",
    },
    {
      reason: "menu: radius 10 and `shadow-menu`, no border",
      upstream: "        \"z-50 min-w-[8rem] origin-(--radix-dropdown-menu-content-transform-origin) overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-lg data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95\",",
      ours: "        \"z-50 min-w-[8rem] origin-(--radix-dropdown-menu-content-transform-origin) overflow-hidden rounded-xl bg-popover p-1 text-popover-foreground shadow-menu data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95\",",
    },
  ],
  "empty": [
    {
      reason: "imports: relative paths with `.js` under NodeNext, `cn` from the theme",
      upstream: "import { cn } from \"cn\"",
      ours: "import { cn } from \"../lib/utils.js\"",
    },
    {
      reason: "empty: hovered inline links in `text-link` (WCAG AA contrast)",
      upstream: "        \"text-sm/relaxed text-muted-foreground [&>a]:underline [&>a]:underline-offset-4 [&>a:hover]:text-primary\",",
      ours: "        \"text-sm/relaxed text-muted-foreground [&>a]:underline [&>a]:underline-offset-4 [&>a:hover]:text-link\",",
    },
  ],
  "field": [
    {
      reason: "imports: relative paths with `.js` under NodeNext, `cn` from the theme",
      upstream: "import { cn } from \"cn\"",
      ours: "import { cn } from \"../lib/utils.js\"",
    },
    {
      reason: "imports: relative paths with `.js` under NodeNext, `cn` from the theme",
      upstream: "import { Label } from \"@/registry/new-york-v4/ui/label\"\nimport { Separator } from \"@/registry/new-york-v4/ui/separator\"",
      ours: "import { Label } from \"./label.js\"\nimport { Separator } from \"./separator.js\"",
    },
    {
      reason: "field: hovered inline links in `text-link` (WCAG AA contrast)",
      upstream: "        \"[&>a]:underline [&>a]:underline-offset-4 [&>a:hover]:text-primary\",",
      ours: "        \"[&>a]:underline [&>a]:underline-offset-4 [&>a:hover]:text-link\",",
    },
  ],
  "input-group": [
    {
      reason: "imports: relative paths with `.js` under NodeNext, `cn` from the theme",
      upstream: "import { cn } from \"cn\"",
      ours: "import { cn } from \"../lib/utils.js\"",
    },
    {
      reason: "imports: relative paths with `.js` under NodeNext, `cn` from the theme",
      upstream: "import { Button } from \"@/registry/new-york-v4/ui/button\"\nimport { Input } from \"@/registry/new-york-v4/ui/input\"\nimport { Textarea } from \"@/registry/new-york-v4/ui/textarea\"",
      ours: "import { Button } from \"./button.js\"\nimport { Input } from \"./input.js\"\nimport { Textarea } from \"./textarea.js\"",
    },
    {
      reason: "field: 28 px high, grey `field` background, no shadow, the theme's focus ring",
      upstream: "        \"group/input-group relative flex w-full items-center rounded-md border border-input shadow-xs transition-[color,box-shadow] outline-none dark:bg-input/30\",\n        \"h-9 min-w-0 has-[>textarea]:h-auto\",",
      ours: "        \"group/input-group relative flex w-full items-center rounded-md border border-input bg-field transition-[color,box-shadow] outline-none\",\n        \"h-7 min-w-0 has-[>textarea]:h-auto\",",
    },
    {
      reason: "focus: `ring-2 ring-ring` instead of `ring-[3px] ring-ring/50`",
      upstream: "        \"has-[[data-slot=input-group-control]:focus-visible]:border-ring has-[[data-slot=input-group-control]:focus-visible]:ring-[3px] has-[[data-slot=input-group-control]:focus-visible]:ring-ring/50\",",
      ours: "        \"has-[[data-slot=input-group-control]:focus-visible]:border-ring has-[[data-slot=input-group-control]:focus-visible]:ring-2 has-[[data-slot=input-group-control]:focus-visible]:ring-ring/50\",",
    },
    {
      reason: "input group: the theme's radius scale",
      upstream: "  \"flex h-auto cursor-text items-center justify-center gap-2 py-1.5 text-sm font-medium text-muted-foreground select-none group-data-[disabled=true]/input-group:opacity-50 [&>kbd]:rounded-[calc(var(--radius)-5px)] [&>svg:not([class*='size-'])]:size-4\",",
      ours: "  \"flex h-auto cursor-text items-center justify-center gap-2 py-1.5 text-sm font-medium text-muted-foreground select-none group-data-[disabled=true]/input-group:opacity-50 [&>kbd]:rounded-xs [&>svg:not([class*='size-'])]:size-4\",",
    },
    {
      reason: "input group: the theme's radius scale",
      upstream: "        xs: \"h-6 gap-1 rounded-[calc(var(--radius)-5px)] px-2 has-[>svg]:px-2 [&>svg:not([class*='size-'])]:size-3.5\",",
      ours: "        xs: \"h-6 gap-1 rounded-sm px-2 has-[>svg]:px-2 [&>svg:not([class*='size-'])]:size-3.5\",",
    },
    {
      reason: "input group: the theme's radius scale",
      upstream: "          \"size-6 rounded-[calc(var(--radius)-5px)] p-0 has-[>svg]:p-0\",",
      ours: "          \"size-6 rounded-sm p-0 has-[>svg]:p-0\",",
    },
  ],
  "input": [
    {
      reason: "imports: relative paths with `.js` under NodeNext, `cn` from the theme",
      upstream: "import { cn } from \"cn\"",
      ours: "import { cn } from \"../lib/utils.js\"",
    },
    {
      reason: "field: 28 px high, grey `field` background, no shadow, the theme's focus ring",
      upstream: "        \"h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none selection:bg-primary selection:text-primary-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30\",\n        \"focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50\",",
      ours: "        \"h-7 w-full min-w-0 rounded-md border border-input bg-field px-2.5 py-1 text-base transition-[color,box-shadow] outline-none selection:bg-primary selection:text-primary-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm\",\n        \"focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring\",",
    },
  ],
  "item": [
    {
      reason: "imports: relative paths with `.js` under NodeNext, `cn` from the theme",
      upstream: "import { cn } from \"cn\"",
      ours: "import { cn } from \"../lib/utils.js\"",
    },
    {
      reason: "imports: relative paths with `.js`; ItemGroup tells its items they are list items",
      upstream: "import { Separator } from \"@/registry/new-york-v4/ui/separator\"",
      ours: "import { Separator } from \"./separator.js\"\n\n// Set by ItemGroup so that its items render as list items (axe aria-required-children).\nconst ItemGroupContext = React.createContext(false)",
    },
    {
      reason: "item group: provides the list context to its items (axe aria-required-children)",
      upstream: "    <div\n      role=\"list\"\n      data-slot=\"item-group\"\n      className={cn(\"group/item-group flex flex-col\", className)}\n      {...props}\n    />",
      ours: "    <ItemGroupContext.Provider value={true}>\n      <div\n        role=\"list\"\n        data-slot=\"item-group\"\n        className={cn(\"group/item-group flex flex-col\", className)}\n        {...props}\n      />\n    </ItemGroupContext.Provider>",
    },
    {
      reason: "focus: `ring-2 ring-ring` instead of `ring-[3px] ring-ring/50`",
      upstream: "  \"group/item flex flex-wrap items-center rounded-md border border-transparent text-sm transition-colors duration-100 outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 [a]:transition-colors [a]:hover:bg-accent/50\",",
      ours: "  \"group/item flex flex-wrap items-center rounded-md border border-transparent text-sm transition-colors duration-100 outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring [a]:transition-colors [a]:hover:bg-accent/50\",",
    },
    {
      reason: "item: `role=listitem` inside an ItemGroup, except an asChild item that keeps its child's role",
      upstream: "  const Comp = asChild ? Slot.Root : \"div\"",
      ours: "  const Comp = asChild ? Slot.Root : \"div\"\n  const isInGroup = React.useContext(ItemGroupContext)\n  // An asChild item keeps its child's own role (a link stays a link).\n  const role = isInGroup && !asChild ? \"listitem\" : undefined",
    },
    {
      reason: "item: `role=listitem` inside an ItemGroup, except an asChild item that keeps its child's role",
      upstream: "    <Comp",
      ours: "    <Comp\n      role={role}",
    },
    {
      reason: "item: hovered inline links in `text-link` (WCAG AA contrast)",
      upstream: "        \"[&>a]:underline [&>a]:underline-offset-4 [&>a:hover]:text-primary\",",
      ours: "        \"[&>a]:underline [&>a]:underline-offset-4 [&>a:hover]:text-link\",",
    },
  ],
  "kbd": [
    {
      reason: "imports: relative paths with `.js` under NodeNext, `cn` from the theme",
      upstream: "import { cn } from \"cn\"",
      ours: "import { cn } from \"../lib/utils.js\"",
    },
  ],
  "label": [
    {
      reason: "imports: relative paths with `.js` under NodeNext, `cn` from the theme",
      upstream: "import { cn } from \"cn\"",
      ours: "import { cn } from \"../lib/utils.js\"",
    },
  ],
  "popover": [
    {
      reason: "imports: relative paths with `.js` under NodeNext, `cn` from the theme",
      upstream: "import { cn } from \"cn\"",
      ours: "import { cn } from \"../lib/utils.js\"",
    },
    {
      reason: "menu: radius 10 and `shadow-menu`, no border",
      upstream: "          \"z-50 w-72 origin-(--radix-popover-content-transform-origin) rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-hidden data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95\",",
      ours: "          \"z-50 w-72 origin-(--radix-popover-content-transform-origin) rounded-xl bg-popover p-4 text-popover-foreground shadow-menu outline-hidden data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95\",",
    },
  ],
  "progress": [
    {
      reason: "imports: relative paths with `.js` under NodeNext, `cn` from the theme",
      upstream: "import { cn } from \"cn\"",
      ours: "import { cn } from \"../lib/utils.js\"",
    },
    {
      reason: "imports: relative paths with `.js`; a caller's fill class is detected",
      upstream: "import { Progress as ProgressPrimitive } from \"radix-ui\"\n",
      ours: "import { Progress as ProgressPrimitive } from \"radix-ui\"\n\nconst FILL_CLASS = /(^|\\s)bg-/\n\nfunction hasFillClass(className: string | undefined): boolean {\n  return className !== undefined && FILL_CLASS.test(className)\n}\n",
    },
    {
      reason: "progress: `indicatorClassName` styles the fill",
      upstream: "  className,",
      ours: "  className,\n  indicatorClassName,",
    },
    {
      reason: "progress: `indicatorClassName` styles the fill",
      upstream: "}: React.ComponentProps<typeof ProgressPrimitive.Root>) {",
      ours: "}: React.ComponentProps<typeof ProgressPrimitive.Root> & {\n  /** Classes merged over the indicator's, e.g. another fill colour. */\n  indicatorClassName?: string\n}) {",
    },
    {
      reason: "progress: `indicatorClassName` styles the fill",
      upstream: "      data-slot=\"progress\"",
      ours: "      data-slot=\"progress\"\n      value={value}",
    },
    {
      reason: "progress: 6 px",
      upstream: "        \"relative h-2 w-full overflow-hidden rounded-full bg-primary/20\",",
      ours: "        \"relative h-1.5 w-full overflow-hidden rounded-full bg-primary/20\",",
    },
    {
      reason: "progress: `indicatorClassName` styles the fill; in dark the default fill is `link` (WCAG 1.4.11 non-text contrast)",
      upstream: "        className=\"h-full w-full flex-1 bg-primary transition-all\"",
      ours: "        className={cn(\n          \"h-full w-full flex-1 bg-primary transition-all\",\n          // In dark the default fill is the lighter link blue, so it reaches 3:1 against its track; a fill colour of\n          // the caller's own replaces both.\n          !hasFillClass(indicatorClassName) && \"dark:bg-link\",\n          indicatorClassName\n        )}",
    },
  ],
  "radio-group": [
    {
      reason: "imports: relative paths with `.js` under NodeNext, `cn` from the theme",
      upstream: "import { cn } from \"cn\"",
      ours: "import { cn } from \"../lib/utils.js\"",
    },
    {
      reason: "radio: 16 px, a 1.5 px `muted-foreground` border that turns `primary` when checked, no shadow, the theme's focus ring",
      upstream: "        \"aspect-square size-4 shrink-0 rounded-full border border-input text-primary shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:bg-input/30 dark:aria-invalid:ring-destructive/40\",",
      ours: "        \"aspect-square size-4 shrink-0 rounded-full border-[1.5px] border-muted-foreground text-primary transition-shadow outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 data-[state=checked]:border-primary dark:aria-invalid:ring-destructive/40\",",
    },
  ],
  "scroll-area": [
    {
      reason: "imports: relative paths with `.js` under NodeNext, `cn` from the theme",
      upstream: "import { cn } from \"cn\"",
      ours: "import { cn } from \"../lib/utils.js\"",
    },
    {
      reason: "scroll area: `viewportProps` reach the viewport",
      upstream: "  children,",
      ours: "  children,\n  viewportProps,",
    },
    {
      reason: "scroll area: `viewportProps` reach the viewport",
      upstream: "}: React.ComponentProps<typeof ScrollAreaPrimitive.Root>) {",
      ours: "}: React.ComponentProps<typeof ScrollAreaPrimitive.Root> & {\n  viewportProps?: React.ComponentProps<typeof ScrollAreaPrimitive.Viewport>\n}) {",
    },
    {
      reason: "scroll area: the viewport is focusable (axe scrollable-region-focusable)",
      upstream: "      className={cn(\"relative\", className)}\n      {...props}\n    >",
      ours: "      className={cn(\"relative\", className)}\n      {...props}\n    >\n      {/* Focusable, so keyboard users can scroll content without focusable elements (axe scrollable-region-focusable). */}",
    },
    {
      reason: "scroll area: the viewport is focusable (axe scrollable-region-focusable)",
      upstream: "      <ScrollAreaPrimitive.Viewport",
      ours: "      <ScrollAreaPrimitive.Viewport\n        tabIndex={0}",
    },
    {
      reason: "focus: `ring-2 ring-ring` instead of `ring-[3px] ring-ring/50`; `viewportProps` with their classes merged",
      upstream: "        className=\"size-full rounded-[inherit] transition-[color,box-shadow] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1\"",
      ours: "        {...viewportProps}\n        className={cn(\n          \"size-full rounded-[inherit] transition-[color,box-shadow] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-1\",\n          viewportProps?.className\n        )}",
    },
  ],
  "select": [
    {
      reason: "imports: relative paths with `.js` under NodeNext, `cn` from the theme",
      upstream: "import { cn } from \"cn\"",
      ours: "import { cn } from \"../lib/utils.js\"",
    },
    {
      reason: "field: 28 px high, grey `field` background, no shadow, the theme's focus ring",
      upstream: "        \"flex w-fit items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 py-2 text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 data-[placeholder]:text-muted-foreground data-[size=default]:h-9 data-[size=sm]:h-8 *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-2 dark:bg-input/30 dark:hover:bg-input/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground\",",
      ours: "        \"flex w-fit items-center justify-between gap-2 rounded-md border border-input bg-field px-2.5 py-1 text-sm whitespace-nowrap transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 data-[placeholder]:text-muted-foreground data-[size=default]:h-7 data-[size=sm]:h-6 *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-2 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground\",",
    },
    {
      reason: "menu: radius 10 and `shadow-menu`, no border",
      upstream: "          \"relative z-50 max-h-(--radix-select-content-available-height) min-w-[8rem] origin-(--radix-select-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-md data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95\",",
      ours: "          \"relative z-50 max-h-(--radix-select-content-available-height) min-w-[8rem] origin-(--radix-select-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-xl bg-popover text-popover-foreground shadow-menu data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95\",",
    },
    {
      reason: "menu item: radius 6, at least 28 px high",
      upstream: "        \"relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2\",",
      ours: "        \"relative flex w-full cursor-default items-center gap-2 rounded-md py-1 min-h-7 pr-8 pl-2 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2\",",
    },
  ],
  "separator": [
    {
      reason: "imports: relative paths with `.js` under NodeNext, `cn` from the theme",
      upstream: "import { cn } from \"cn\"",
      ours: "import { cn } from \"../lib/utils.js\"",
    },
  ],
  "sheet": [
    {
      reason: "imports: relative paths with `.js` under NodeNext, `cn` from the theme",
      upstream: "import { cn } from \"cn\"",
      ours: "import { en as messages } from \"../messages/en.js\"\nimport { cn } from \"../lib/utils.js\"",
    },
    {
      reason: "overlay: the `overlay` token instead of `bg-black/50`",
      upstream: "        \"fixed inset-0 z-50 bg-black/50 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0\",",
      ours: "        \"fixed inset-0 z-50 bg-overlay data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0\",",
    },
    {
      reason: "copy: built-in English text from the message layer, overridable by a prop",
      upstream: "  showCloseButton = true,",
      ours: "  showCloseButton = true,\n  closeLabel = messages.sheet.close,",
    },
    {
      reason: "copy: built-in English text from the message layer, overridable by a prop",
      upstream: "  showCloseButton?: boolean",
      ours: "  showCloseButton?: boolean\n  // The close button's hidden text, from the app's message layer.\n  closeLabel?: string",
    },
    {
      reason: "copy: built-in English text from the message layer, overridable by a prop",
      upstream: "            <span className=\"sr-only\">Close</span>",
      ours: "            <span className=\"sr-only\">{closeLabel}</span>",
    },
  ],
  "sidebar": [
    {
      reason: "imports: relative paths with `.js` under NodeNext, `cn` from the theme",
      upstream: "import { cn } from \"cn\"",
      ours: "import { en as messages } from \"../messages/en.js\"\nimport { cn } from \"../lib/utils.js\"",
    },
    {
      reason: "imports: relative paths with `.js`, `useIsMobile` from the kit",
      upstream: "import { useIsMobile } from \"@/registry/new-york-v4/hooks/use-mobile\"\nimport { Button } from \"@/registry/new-york-v4/ui/button\"\nimport { Input } from \"@/registry/new-york-v4/ui/input\"\nimport { Separator } from \"@/registry/new-york-v4/ui/separator\"",
      ours: "import { useIsMobile } from \"@softure-ai/theme-kit/react\"\nimport { Button } from \"./button.js\"\nimport { Input } from \"./input.js\"\nimport { Separator } from \"./separator.js\"",
    },
    {
      reason: "imports: relative paths with `.js` under NodeNext, `cn` from the theme",
      upstream: "} from \"@/registry/new-york-v4/ui/sheet\"\nimport { Skeleton } from \"@/registry/new-york-v4/ui/skeleton\"",
      ours: "} from \"./sheet.js\"\nimport { Skeleton } from \"./skeleton.js\"",
    },
    {
      reason: "imports: relative paths with `.js` under NodeNext, `cn` from the theme",
      upstream: "} from \"@/registry/new-york-v4/ui/tooltip\"",
      ours: "} from \"./tooltip.js\"",
    },
    {
      reason: "sidebar: only an uncontrolled sidebar writes the cookie",
      upstream: "        _setOpen(openState)",
      ours: "        _setOpen(openState)\n        // This sets the cookie to keep the sidebar state; a controlled sidebar keeps nothing in the browser.\n        document.cookie = `${SIDEBAR_COOKIE_NAME}=${openState}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`",
    },
    {
      reason: "sidebar: only an uncontrolled sidebar writes the cookie",
      upstream: "      }\n\n      // This sets the cookie to keep the sidebar state.\n      document.cookie = `${SIDEBAR_COOKIE_NAME}=${openState}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`",
      ours: "      }",
    },
    {
      reason: "copy: built-in English text from the message layer, overridable by a prop",
      upstream: "  collapsible = \"offcanvas\",",
      ours: "  collapsible = \"offcanvas\",\n  mobileTitle = messages.sidebar.mobileTitle,\n  mobileDescription = messages.sidebar.mobileDescription,",
    },
    {
      reason: "copy: built-in English text from the message layer, overridable by a prop",
      upstream: "  collapsible?: \"offcanvas\" | \"icon\" | \"none\"",
      ours: "  collapsible?: \"offcanvas\" | \"icon\" | \"none\"\n  // The phone sheet's accessible title and description, from the app's message layer.\n  mobileTitle?: string\n  mobileDescription?: string",
    },
    {
      reason: "copy: built-in English text from the message layer, overridable by a prop",
      upstream: "            <SheetTitle>Sidebar</SheetTitle>\n            <SheetDescription>Displays the mobile sidebar.</SheetDescription>",
      ours: "            <SheetTitle>{mobileTitle}</SheetTitle>\n            <SheetDescription>{mobileDescription}</SheetDescription>",
    },
    {
      reason: "copy: built-in English text from the message layer, overridable by a prop",
      upstream: "  onClick,",
      ours: "  onClick,\n  label = messages.sidebar.toggle,",
    },
    {
      reason: "copy: built-in English text from the message layer, overridable by a prop",
      upstream: "}: React.ComponentProps<typeof Button>) {",
      ours: "}: React.ComponentProps<typeof Button> & {\n  // The hidden text of the toggle, from the app's message layer.\n  label?: string\n}) {",
    },
    {
      reason: "copy: built-in English text from the message layer, overridable by a prop",
      upstream: "      <span className=\"sr-only\">Toggle Sidebar</span>",
      ours: "      <span className=\"sr-only\">{label}</span>",
    },
    {
      reason: "copy: built-in English text from the message layer, overridable by a prop",
      upstream: "function SidebarRail({ className, ...props }: React.ComponentProps<\"button\">) {",
      ours: "function SidebarRail({\n  className,\n  label = messages.sidebar.toggle,\n  ...props\n}: React.ComponentProps<\"button\"> & {\n  // The rail's accessible name and tooltip, from the app's message layer.\n  label?: string\n}) {",
    },
    {
      reason: "copy: built-in English text from the message layer, overridable by a prop",
      upstream: "      aria-label=\"Toggle Sidebar\"",
      ours: "      aria-label={label}",
    },
    {
      reason: "copy: built-in English text from the message layer, overridable by a prop",
      upstream: "      title=\"Toggle Sidebar\"",
      ours: "      title={label}",
    },
    {
      reason: "sidebar: the group label in `muted-foreground` instead of `sidebar-foreground/70` (WCAG AA contrast)",
      upstream: "        \"flex h-8 shrink-0 items-center rounded-md px-2 text-xs font-medium text-sidebar-foreground/70 ring-sidebar-ring outline-hidden transition-[margin,opacity] duration-200 ease-linear focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0\",",
      ours: "        \"flex h-8 shrink-0 items-center rounded-md px-2 text-xs font-medium text-muted-foreground ring-sidebar-ring outline-hidden transition-[margin,opacity] duration-200 ease-linear focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0\",",
    },
    {
      reason: "sidebar: the menu skeleton's width is stable per item (pure render)",
      upstream: "  // Random width between 50 to 90%.",
      ours: "  // A width between 50 and 90%, stable per skeleton (shadcn draws a random one, which is impure during render).\n  const id = React.useId()",
    },
    {
      reason: "sidebar: the menu skeleton's width is stable per item (pure render)",
      upstream: "    return `${Math.floor(Math.random() * 40) + 50}%`\n  }, [])",
      ours: "    const seed = [...id].reduce((sum, char) => sum + char.charCodeAt(0), 0)\n    return `${(seed % 40) + 50}%`\n  }, [id])",
    },
  ],
  "skeleton": [
    {
      reason: "imports: relative paths with `.js` under NodeNext, `cn` from the theme",
      upstream: "import { cn } from \"cn\"",
      ours: "import { cn } from \"../lib/utils.js\"",
    },
  ],
  "sonner": [
    {
      reason: "sonner: no `next-themes`; `theme` is a prop",
      upstream: "} from \"lucide-react\"\nimport { useTheme } from \"next-themes\"",
      ours: "} from \"lucide-react\"",
    },
    {
      reason: "sonner: no `next-themes`; `theme` is a prop",
      upstream: "const Toaster = ({ ...props }: ToasterProps) => {\n  const { theme = \"system\" } = useTheme()\n",
      ours: "// The toast stack. `theme` follows the system by default; pass the app's chosen scheme (\"light\" | \"dark\") when it\n// has a theme switch (shadcn reads it from `next-themes`, which this package does not require).\nconst Toaster = ({ theme = \"system\", ...props }: ToasterProps) => {",
    },
    {
      reason: "sonner: no `next-themes`; `theme` is a prop",
      upstream: "      theme={theme as ToasterProps[\"theme\"]}",
      ours: "      theme={theme}",
    },
    {
      reason: "sonner: the toast radius is the theme's `radius-lg`",
      upstream: "          \"--border-radius\": \"var(--radius)\",",
      ours: "          \"--border-radius\": \"var(--radius-lg)\",",
    },
  ],
  "spinner": [
    {
      reason: "imports: relative paths with `.js` under NodeNext, `cn` from the theme",
      upstream: "import { cn } from \"cn\"",
      ours: "import { en as messages } from \"../messages/en.js\"\nimport { cn } from \"../lib/utils.js\"",
    },
    {
      reason: "copy: built-in English text from the message layer, overridable by a prop",
      upstream: "      aria-label=\"Loading\"",
      ours: "      aria-label={messages.spinner.label}",
    },
  ],
  "switch": [
    {
      reason: "imports: relative paths with `.js`, the shared thumb shadow",
      upstream: "import { cn } from \"cn\"",
      ours: "import { cn } from \"../lib/utils.js\"\nimport { SWITCH_THUMB_SHADOW_CLASS } from \"./switch-thumb.js\"",
    },
    {
      reason: "switch: 26 × 16, the theme's focus ring",
      upstream: "        \"peer group/switch inline-flex shrink-0 items-center rounded-full border border-transparent shadow-xs transition-all outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-[size=default]:h-[1.15rem] data-[size=default]:w-8 data-[size=sm]:h-3.5 data-[size=sm]:w-6 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input dark:data-[state=unchecked]:bg-input/80\",",
      ours: "        \"peer group/switch inline-flex shrink-0 items-center rounded-full border border-transparent transition-all outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 data-[size=default]:h-4 data-[size=default]:w-[26px] data-[size=default]:p-0.5 data-[size=sm]:h-3.5 data-[size=sm]:w-[22px] data-[size=sm]:p-0.5 data-[state=checked]:bg-primary data-[state=unchecked]:bg-control-off\",",
    },
    {
      reason: "switch: a 12 px thumb with the shared shadow",
      upstream: "          \"pointer-events-none block rounded-full bg-background ring-0 transition-transform group-data-[size=default]/switch:size-4 group-data-[size=sm]/switch:size-3 data-[state=checked]:translate-x-[calc(100%-2px)] data-[state=unchecked]:translate-x-0 dark:data-[state=checked]:bg-primary-foreground dark:data-[state=unchecked]:bg-foreground\"",
      ours: "          \"pointer-events-none block rounded-full bg-background ring-0 transition-transform group-data-[size=default]/switch:size-3 group-data-[size=sm]/switch:size-2.5 data-[state=checked]:translate-x-[10px] data-[state=unchecked]:translate-x-0\",\n          SWITCH_THUMB_SHADOW_CLASS",
    },
  ],
  "table": [
    {
      reason: "imports: relative paths with `.js` under NodeNext, `cn` from the theme",
      upstream: "import { cn } from \"cn\"",
      ours: "import { cn } from \"../lib/utils.js\"",
    },
    {
      reason: "table: a line under the last row too",
      upstream: "      className={cn(\"[&_tr:last-child]:border-0\", className)}",
      ours: "      className={cn(className)}",
    },
    {
      reason: "table: a 34 px header in `muted-foreground`",
      upstream: "        \"h-10 px-2 text-left align-middle font-medium whitespace-nowrap text-foreground [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]\",",
      ours: "        \"h-[34px] px-2 text-left align-middle font-normal whitespace-nowrap text-muted-foreground [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]\",",
    },
  ],
  "tabs": [
    {
      reason: "imports: relative paths with `.js` under NodeNext, `cn` from the theme",
      upstream: "import { cn } from \"cn\"",
      ours: "import { cn } from \"../lib/utils.js\"",
    },
    {
      reason: "tabs: the `line` variant by default",
      upstream: "      variant: \"default\",",
      ours: "      variant: \"line\",",
    },
    {
      reason: "tabs: the `line` variant by default",
      upstream: "  variant = \"default\",",
      ours: "  variant = \"line\",",
    },
    {
      reason: "tabs: the trigger in `muted-foreground` instead of `foreground/60` (WCAG AA contrast); the theme's focus ring; the active default tab outlined in `input` (`ring` when focused) on `accent/40` in dark (WCAG 1.4.11)",
      upstream: "        \"relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-sm font-medium whitespace-nowrap text-foreground/60 transition-all group-data-[orientation=vertical]/tabs:w-full group-data-[orientation=vertical]/tabs:justify-start hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 group-data-[variant=default]/tabs-list:data-[state=active]:shadow-sm group-data-[variant=line]/tabs-list:data-[state=active]:shadow-none dark:text-muted-foreground dark:hover:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4\",\n        \"group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:data-[state=active]:bg-transparent dark:group-data-[variant=line]/tabs-list:data-[state=active]:border-transparent dark:group-data-[variant=line]/tabs-list:data-[state=active]:bg-transparent\",\n        \"data-[state=active]:bg-background data-[state=active]:text-foreground dark:data-[state=active]:border-input dark:data-[state=active]:bg-input/30 dark:data-[state=active]:text-foreground\",",
      ours: "        \"relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-sm font-medium whitespace-nowrap text-muted-foreground transition-all group-data-[orientation=vertical]/tabs:w-full group-data-[orientation=vertical]/tabs:justify-start hover:text-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-1 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 group-data-[variant=default]/tabs-list:data-[state=active]:shadow-sm group-data-[variant=line]/tabs-list:data-[state=active]:shadow-none dark:hover:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4\",\n        \"group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:data-[state=active]:bg-transparent group-data-[variant=line]/tabs-list:data-[state=active]:border-transparent dark:group-data-[variant=line]/tabs-list:data-[state=active]:bg-transparent\",\n        \"bg-clip-padding data-[state=active]:border-input data-[state=active]:bg-background data-[state=active]:text-foreground focus-visible:data-[state=active]:border-ring dark:data-[state=active]:bg-accent/40 dark:data-[state=active]:text-foreground\",",
    },
  ],
  "textarea": [
    {
      reason: "imports: relative paths with `.js` under NodeNext, `cn` from the theme",
      upstream: "import { cn } from \"cn\"",
      ours: "import { cn } from \"../lib/utils.js\"",
    },
    {
      reason: "field: 28 px high, grey `field` background, no shadow, the theme's focus ring",
      upstream: "        \"flex field-sizing-content min-h-16 w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:aria-invalid:ring-destructive/40\",",
      ours: "        \"flex field-sizing-content min-h-16 w-full rounded-md border border-input bg-field px-2.5 py-1.5 text-base transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 md:text-sm dark:aria-invalid:ring-destructive/40\",",
    },
  ],
  "tooltip": [
    {
      reason: "imports: relative paths with `.js` under NodeNext, `cn` from the theme",
      upstream: "import { cn } from \"cn\"",
      ours: "import { cn } from \"../lib/utils.js\"",
    },
    {
      reason: "tooltip: dark `tooltip` token, radius 4, medium weight",
      upstream: "          \"z-50 w-fit origin-(--radix-tooltip-content-transform-origin) animate-in rounded-md bg-foreground px-3 py-1.5 text-xs text-balance text-background fade-in-0 zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95\",",
      ours: "          \"z-50 w-fit origin-(--radix-tooltip-content-transform-origin) animate-in rounded-sm bg-tooltip px-2 py-1 text-xs font-medium text-balance text-tooltip-foreground fade-in-0 zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95\",",
    },
    {
      reason: "tooltip: no arrow",
      upstream: "        {children}\n        <TooltipPrimitive.Arrow className=\"z-50 size-2.5 translate-y-[calc(-50%_-_2px)] rotate-45 rounded-[2px] bg-foreground fill-foreground\" />",
      ours: "        {children}",
    },
  ],
};
