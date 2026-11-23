import type { ReactNode } from "react";

import { cn } from "../lib/utils.js";
import { PageHeader, type PageHeaderProps } from "./PageHeader.js";

/** `full` takes the content area's width; `content` caps a reading page at the Notion reading width and centres it. */
export type PageLayoutWidth = "full" | "content";

export interface PageLayoutProps {
  // The page's header, rendered once at the top: the same props as `PageHeader`.
  header: PageHeaderProps;
  // The page's sections, usually titled `Card`s, spaced like every other screen.
  children?: ReactNode;
  width?: PageLayoutWidth;
  className?: string;
}

const WIDTH_CLASSES: Record<PageLayoutWidth, string> = {
  full: "",
  content: "mx-auto max-w-3xl",
};

/**
 * A screen inside the app shell: its `PageHeader`, then its sections, with one width and one spacing on every page.
 * `min-w-0` keeps a wide table scrolling inside its card instead of widening the page.
 */
export function PageLayout({ header, children, width = "full", className }: PageLayoutProps) {
  return (
    <div data-slot="page-layout" data-width={width} className={cn("grid w-full min-w-0 gap-4", WIDTH_CLASSES[width], className)}>
      <PageHeader {...header} />
      {children}
    </div>
  );
}
