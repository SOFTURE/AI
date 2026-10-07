// Funnel steps on pages, one line each. `<FunnelPixel step="landing" />` counts a page view with an
// image (no JavaScript); `<FunnelBeacon step="pricing" />` counts it with a beacon once the page
// runs in the browser. Both check at render time that the step exists and is of their kind, so a
// typo fails on the first render instead of counting nothing.
import type { SoftureConfig } from "@softure-ai/core";
import { getSoftureConfig } from "@softure-ai/core/next";
import type { FunnelStepSource } from "../options.js";
import { getAnalyticsOptions, getFunnelEndpoint, getFunnelStepField } from "../server/options.js";
import { FunnelBeaconReporter } from "../ui/funnel-beacon.js";

export interface FunnelStepProps {
  /** A step id from `analytics({ funnel: { steps } })`. */
  readonly step: string;
}

export interface FunnelPixelProps extends FunnelStepProps {
  /**
   * The image's class. Without one the image is positioned absolutely, so it adds no line box to
   * the page's flow; with one, the class alone decides.
   */
  readonly className?: string;
}

/** Out of the flow by default: an inline image in block layout adds a line box. */
const PIXEL_STYLE = { position: "absolute" } as const;

export function FunnelPixel({ step, className }: FunnelPixelProps) {
  const config = getSoftureConfig();
  assertStepKind(config, step, "pixel");
  const src = `${getFunnelEndpoint(config)}?${new URLSearchParams({ [getFunnelStepField(config)]: step }).toString()}`;
  // A plain image on purpose: it must load on every view (no lazy loading, no optimiser) and send
  // the page as its Referer. Decorative, so its alt text is empty.
  return (
    <img
      src={src}
      alt=""
      width={1}
      height={1}
      decoding="async"
      aria-hidden="true"
      data-funnel-step={step}
      {...(className === undefined ? { style: PIXEL_STYLE } : { className })}
    />
  );
}

export function FunnelBeacon({ step }: FunnelStepProps) {
  const config = getSoftureConfig();
  assertStepKind(config, step, "beacon");
  return <FunnelBeaconReporter endpoint={getFunnelEndpoint(config)} step={step} stepField={getFunnelStepField(config)} />;
}

function assertStepKind(config: SoftureConfig, id: string, via: Exclude<FunnelStepSource, "server">): void {
  const step = getAnalyticsOptions(config).funnel.steps.find((candidate) => candidate.id === id);
  if (step?.via !== via) {
    throw new Error(`@softure-ai/analytics: "${id}" is not a ${via} step of analytics({ funnel: { steps } })`);
  }
}
