"use client";

// Takes the unsubscribe link's parameters out of the address bar once the page has loaded, so the
// signed token does not stay in the tab's URL and the browser history. It renders nothing; without
// JavaScript the address bar keeps the link, and the form still works.
import { useEffect } from "react";

export interface StripLinkQueryProps {
  /** The query parameters that carry the link. */
  readonly names: readonly string[];
}

export function StripLinkQuery({ names }: StripLinkQueryProps) {
  useEffect(() => {
    stripQueryParams(names);
  }, [names]);
  return null;
}

/**
 * Replaces the current history entry with the URL minus `names`. The current `history.state` goes
 * along: it carries Next's own marker, so its router lets the call through without a navigation.
 */
export function stripQueryParams(names: readonly string[]): void {
  const url = new URL(location.href);
  const present = names.filter((name) => url.searchParams.has(name));
  if (present.length === 0) return;
  for (const name of present) url.searchParams.delete(name);
  history.replaceState(history.state, "", `${url.pathname}${url.search}${url.hash}`);
}
