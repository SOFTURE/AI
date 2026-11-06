import type { AnchorHTMLAttributes, HTMLAttributes, ReactNode } from "react";

import { cn } from "../lib/utils.js";

import { WORDMARK_LOOK } from "./button-look.js";

/** `over-map`: transparent on the hero; `solid`: on the page background with a hairline, for subpages and sticky use. */
export type SiteHeaderVariant = "over-map" | "solid";

export interface SiteHeaderProps extends Omit<HTMLAttributes<HTMLElement>, "children"> {
  /** The wordmark (or any brand link) on the left. */
  readonly brand: ReactNode;
  /** The slot on the right: navigation, a menu button; empty is fine. */
  readonly children?: ReactNode;
  readonly variant?: SiteHeaderVariant;
}

/** The 64 px page header: the wordmark on the left, a slot on the right. It stays flat when it sticks (use `solid`). */
export function SiteHeader({ brand, children, variant = "over-map", className, ...props }: SiteHeaderProps) {
  return (
    <header
      data-slot="site-header"
      data-variant={variant}
      className={cn(
        "flex h-header items-center justify-between gap-4 px-4 text-foreground md:px-6",
        variant === "solid" ? "border-b border-border bg-background" : "bg-transparent",
        className,
      )}
      {...props}
    >
      {brand}
      <div data-slot="site-header-slot" className="flex min-h-control-md items-center gap-2">
        {children}
      </div>
    </header>
  );
}

export interface WordmarkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "children" | "href"> {
  /** The link target, the home page as a rule. */
  readonly href: string;
  /** The project's logo (an `<img>` or `<svg>`), drawn at 44 px; decorative, the name follows it. */
  readonly mark?: ReactNode;
  /** The name in capitals at 0.1em. */
  readonly name: string;
  /** A muted ending after the name, such as a domain. */
  readonly suffix?: string;
}

/** The logo and the site's name as one link. For a router link, put `WORDMARK_LOOK` on it instead. */
export function Wordmark({ href, mark, name, suffix, className, ...props }: WordmarkProps) {
  return (
    <a href={href} data-slot="wordmark" className={cn(WORDMARK_LOOK, className)} {...props}>
      {mark}
      <span>
        {name}
        {suffix === undefined ? null : <span className="text-muted">{suffix}</span>}
      </span>
    </a>
  );
}
