"use client";

// Puts the channel tag back on the address bar after a client navigation that dropped it
// (`<ChannelKeeper>` passes the rule). It renders nothing. A layout effect, so the
// page's own effects (`<FunnelBeacon>`) already see the tagged URL as their `Referer`.
// `history.replaceState` is the App Router's supported way to change the URL from app code: it
// updates the router's state without a request. It lives in the Next adapter because it reads the
// router's hooks (NFR-3 keeps `ui/` framework-free).
import { usePathname, useSearchParams } from "next/navigation";
import { useLayoutEffect, useRef } from "react";
import { createChannelKeeper, type ChannelRule } from "../client/channel-keeper.js";

export interface ChannelKeeperClientProps {
  readonly rule: ChannelRule;
}

export function ChannelKeeperClient({ rule }: ChannelKeeperClientProps) {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const keep = useRef<((href: string) => string | null) | null>(null);
  const { param, pattern, flags, maxLength } = rule;
  useLayoutEffect(() => {
    keep.current ??= createChannelKeeper({ param, pattern, flags, maxLength });
    const tagged = keep.current(window.location.href);
    if (tagged !== null) window.history.replaceState(null, "", tagged);
  }, [pathname, search, param, pattern, flags, maxLength]);
  return null;
}
