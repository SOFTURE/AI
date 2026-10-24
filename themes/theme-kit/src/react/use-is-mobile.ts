import * as React from "react";

/** The width below which shadcn/ui's sidebar turns into a sheet. */
export const MOBILE_BREAKPOINT = 768;

const MOBILE_QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;

function subscribeToViewport(onChange: () => void): () => void {
  const query = window.matchMedia(MOBILE_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function isMobileViewport(): boolean {
  return window.matchMedia(MOBILE_QUERY).matches;
}

// The server renders the desktop layout; the browser switches on hydration.
function isMobileOnServer(): boolean {
  return false;
}

/**
 * Whether the viewport is narrower than `MOBILE_BREAKPOINT` (shadcn/ui's `useIsMobile`, read through
 * `useSyncExternalStore` instead of a state set inside an effect).
 */
export function useIsMobile(): boolean {
  return React.useSyncExternalStore(subscribeToViewport, isMobileViewport, isMobileOnServer);
}
