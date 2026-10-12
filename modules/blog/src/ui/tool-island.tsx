"use client";

import { useSyncExternalStore, type ReactNode } from "react";

// The mount point of a tool block (GitHub issue 413). The server and the first client render show the tool's static
// HTML, so bots and readers without JavaScript get it and hydration matches; once hydrated, the island (the
// `children`, rendered by the server component with the tool's parsed props) takes its place. The island is
// therefore never rendered on the server and may use browser APIs.

export interface BlogToolIslandProps {
  /** The directive's name, set as `data-blog-tool`. */
  readonly name: string;
  readonly className: string;
  /** The tool's static HTML (the app's trusted output of `renderStatic`). */
  readonly html: string;
  /** The island element. */
  readonly children: ReactNode;
}

function subscribe(): () => void {
  return () => undefined;
}

function getClientSnapshot(): boolean {
  return true;
}

function getServerSnapshot(): boolean {
  return false;
}

export function BlogToolIsland({ name, className, html, children }: BlogToolIslandProps) {
  const isHydrated = useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
  return isHydrated ? (
    <div className={className} data-blog-tool={name} data-state="live">
      {children}
    </div>
  ) : (
    <div className={className} data-blog-tool={name} data-state="static" dangerouslySetInnerHTML={{ __html: html }} />
  );
}
