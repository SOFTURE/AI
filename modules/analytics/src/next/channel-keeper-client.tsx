"use client";

// Puts the channel tag back on the address bar after a client navigation that dropped it
// (`<ChannelKeeper>` passes the rule). It renders nothing. A layout effect, so the
// page's own effects (`<FunnelBeacon>`) already see the tagged URL as their `Referer`.
// `history.replaceState` is the App Router's supported way to change the URL from app code: it
// updates the router's state without a request. It lives in the Next adapter because it reads the
// router's hooks (NFR-3 keeps `ui/` framework-free). With more than one first-party origin it also
// tags links to the other origins on click.
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useLayoutEffect, useRef } from "react";
import { createChannelKeeper, type ChannelKeeper, type ChannelRule } from "../client/channel-keeper.js";

export interface ChannelKeeperClientProps {
  readonly rule: ChannelRule;
}

export function ChannelKeeperClient({ rule }: ChannelKeeperClientProps) {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const keep = useRef<ChannelKeeper | null>(null);
  const { param, pattern, flags, maxLength, normalize } = rule;
  // A string, not the array: the server component hands a new array on every render.
  const origins = (rule.origins ?? []).join(" ");

  useLayoutEffect(() => {
    keep.current ??= createChannelKeeper({ param, pattern, flags, maxLength, normalize, origins: splitOrigins(origins) });
    const tagged = keep.current(window.location.href);
    if (tagged !== null) window.history.replaceState(null, "", tagged);
  }, [pathname, search, param, pattern, flags, maxLength, normalize, origins]);

  // A link to the app's other origin gets the tag just before the browser follows it: the default
  // referrer policy drops the query from a cross-origin Referer. Capture phase, so it runs before
  // the router's own handler; `auxclick` covers the middle button.
  useEffect(() => {
    if (origins === "") return undefined;
    const onClick = (event: MouseEvent) => {
      const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(anchor instanceof HTMLAnchorElement) || keep.current === null) return;
      const tagged = keep.current.tagLink(anchor.href, window.location.href);
      if (tagged !== null) anchor.href = tagged;
    };
    document.addEventListener("click", onClick, true);
    document.addEventListener("auxclick", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("auxclick", onClick, true);
    };
  }, [origins]);
  return null;
}

function splitOrigins(origins: string): string[] {
  return origins === "" ? [] : origins.split(" ");
}
