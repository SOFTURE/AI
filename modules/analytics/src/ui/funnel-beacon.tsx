"use client";

// Reports one beacon step when it mounts (`<FunnelBeacon>` from `/next` passes the endpoint). It
// renders nothing; a remount in the same page view does not count the step again.
import { useEffect, useRef } from "react";
import { createFunnelReporter } from "../client/index.js";

export interface FunnelBeaconReporterProps {
  readonly endpoint: string;
  readonly step: string;
  /** The field that names the step; `step` by default. */
  readonly stepField?: string;
}

export function FunnelBeaconReporter({ endpoint, step, stepField }: FunnelBeaconReporterProps) {
  const report = useRef<((step: string) => void) | null>(null);
  useEffect(() => {
    report.current ??= createFunnelReporter(endpoint, undefined, stepField === undefined ? {} : { stepField });
    report.current(step);
  }, [endpoint, step, stepField]);
  return null;
}
