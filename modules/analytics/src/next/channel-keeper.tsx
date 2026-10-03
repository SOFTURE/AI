// The channel tag on client navigations, one line in the root layout: `<ChannelKeeper />`. The
// proxy re-tags the navigations it can recognise; this covers the rest in the browser (README §4).
// Its own entry point (`/next/channel-keeper`), not `/next`: its client part imports
// `next/navigation`, which plain Node cannot load, and `softure.config.ts` imports `/next` when
// `softure migrate` runs.
import { getSoftureConfig } from "@softure-ai/core/next";
import { Suspense } from "react";
import { getChannelRule } from "../server/options.js";
import { ChannelKeeperClient } from "./channel-keeper-client.js";

export function ChannelKeeper() {
  // `useSearchParams` needs a Suspense boundary, or a static page would render on the client only.
  return (
    <Suspense fallback={null}>
      <ChannelKeeperClient rule={getChannelRule(getSoftureConfig())} />
    </Suspense>
  );
}
