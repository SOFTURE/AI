// The browser side of the funnel: a step goes out with
// `navigator.sendBeacon`, and nothing but the step's id leaves the browser. The channel is not in
// the body: the endpoint reads it from the page the beacon was sent from (`Referer`), exactly as
// the rest of the module does.
//
// `sendBeacon`, not `fetch`: the browser queues the beacon and sends it even when the tab closes
// mid-step, which is the drop-off the funnel is there to see. Without `sendBeacon` (an old browser)
// nothing is counted and the page works on.
export { createChannelKeeper, type ChannelKeeper, type ChannelRule } from "./channel-keeper.js";

/** The part of `navigator` the reporter needs. */
export interface FunnelBeaconTarget {
  sendBeacon?: (url: string, data?: BodyInit | null) => boolean;
}

/** The beacon's body: `<field>=<id>`, `step=<id>` by default (`funnel.wire.stepFields[0]`). */
export function buildFunnelBody(step: string, field = "step"): string {
  return new URLSearchParams({ [field]: step }).toString();
}

export interface FunnelReporterOptions {
  /** The field that names the step; `funnel.wire.stepFields[0]` (`getFunnelStepField`), `step` by default. */
  readonly stepField?: string;
}

/**
 * A function that reports each step at most once in its lifetime (one page view when the page
 * creates it once): going back and forward again does not count the step twice, because the
 * funnel counts visits that reached a step, not clicks.
 */
export function createFunnelReporter(
  endpoint: string,
  target: FunnelBeaconTarget | undefined = typeof navigator === "undefined" ? undefined : navigator,
  options: FunnelReporterOptions = {},
): (step: string) => void {
  const sent = new Set<string>();
  return (step) => {
    if (sent.has(step)) return;
    sent.add(step);
    if (typeof target?.sendBeacon !== "function") return;
    try {
      target.sendBeacon(endpoint, buildFunnelBody(step, options.stepField));
    } catch (error) {
      // The counter must never break the page. The name only: a message could carry the page's URL.
      console.debug(`@softure-ai/analytics: the funnel beacon failed: ${error instanceof Error ? error.name : typeof error}`);
    }
  };
}
