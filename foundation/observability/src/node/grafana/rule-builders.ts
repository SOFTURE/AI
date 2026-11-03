import { createHash } from "node:crypto";

import type { GrafanaRule, GrafanaRuleQuery } from "./rules-file.js";

/**
 * The resource attributes a process exports with, as passed to `startObservability` / `registerObservability`
 * (`serviceNamespace`, `serviceName`, `environment`). Grafana stores them as the labels `service_namespace`,
 * `service_name` and `deployment_environment`.
 */
export type ObservedService = {
  namespace: string;
  name: string;
  environment: string;
};

export type ServiceSilentRuleOptions = {
  service: ObservedService;
  /** UID of the Prometheus (Mimir) data source the metrics land in. */
  datasourceUid: string;
  /** How long the service has sent no metrics before the rule fires. Default 10. */
  windowMinutes?: number;
  /** Pending period, e.g. `"5m"`. Default `"0s"`: the window already waits. */
  for?: string;
  /** Default: a stable uid derived from the service. */
  uid?: string;
  /** Default: `<namespace>/<name> (<environment>) is silent`. */
  title?: string;
};

export type LogProblemsRuleOptions = {
  service: ObservedService;
  /** UID of the Loki data source the logs land in. */
  datasourceUid: string;
  /** Log levels that fire the rule, as the logger writes them in `severity_text`. Default `["WARN", "ERROR"]`. */
  severities?: readonly string[];
  /** How far back each evaluation counts records. Default 5. */
  windowMinutes?: number;
  /** Pending period. Default `"0s"`. */
  for?: string;
  uid?: string;
  /** Default: `<namespace>/<name> (<environment>) logs WARN or ERROR`. */
  title?: string;
};

const DEFAULT_SILENT_WINDOW_MINUTES = 10;
const DEFAULT_LOG_WINDOW_MINUTES = 5;
const DEFAULT_SEVERITIES = ["WARN", "ERROR"] as const;
const EXPRESSION_DATASOURCE = "__expr__";

/**
 * "The service is silent": fires when `target_info` of the service has no sample for `windowMinutes`. A service
 * that exports metrics sends `target_info` with every export. Build one per process, e.g. the app and its worker.
 */
export function buildServiceSilentRule(options: ServiceSilentRuleOptions): GrafanaRule {
  const windowMinutes = options.windowMinutes ?? DEFAULT_SILENT_WINDOW_MINUTES;
  const { service } = options;
  const expr = `absent_over_time(target_info{${formatSelector(service, "=")}}[${String(windowMinutes)}m])`;
  return buildThresholdRule({
    uid: options.uid ?? deriveRuleUid("silent", service),
    title: options.title ?? `${describeService(service)} is silent`,
    service,
    forDuration: options.for ?? "0s",
    query: {
      refId: "A",
      datasourceUid: options.datasourceUid,
      relativeTimeRange: { from: windowMinutes * 60, to: 0 },
      model: { refId: "A", expr, instant: true, range: false },
    },
    summary: `No metrics from ${describeService(service)} for ${String(windowMinutes)} minutes.`,
  });
}

/** "Warnings or errors in the logs": fires when the service logged a record at one of `severities`. */
export function buildLogProblemsRule(options: LogProblemsRuleOptions): GrafanaRule {
  const windowMinutes = options.windowMinutes ?? DEFAULT_LOG_WINDOW_MINUTES;
  const severities = options.severities ?? DEFAULT_SEVERITIES;
  if (severities.length === 0) {
    throw new Error("buildLogProblemsRule: severities is empty");
  }
  const { service } = options;
  const severityPattern = severities.map(escapeRegex).join("|");
  const stream = `{${formatSelector(service, "=")}} | severity_text=~${quote(severityPattern)}`;
  const expr = `sum(count_over_time(${stream} [${String(windowMinutes)}m]))`;
  return buildThresholdRule({
    uid: options.uid ?? deriveRuleUid("logs", service),
    title: options.title ?? `${describeService(service)} logs ${severities.join(" or ")}`,
    service,
    forDuration: options.for ?? "0s",
    query: {
      refId: "A",
      datasourceUid: options.datasourceUid,
      relativeTimeRange: { from: windowMinutes * 60, to: 0 },
      model: { refId: "A", expr, queryType: "instant" },
    },
    summary: `${describeService(service)} logged ${severities.join(" or ")} in the last ${String(windowMinutes)} minutes.`,
  });
}

type ThresholdRuleParts = {
  uid: string;
  title: string;
  service: ObservedService;
  forDuration: string;
  query: GrafanaRuleQuery;
  summary: string;
};

/** Query A, reduced to its last value (B), fires above zero (C). No data means nothing is wrong. */
function buildThresholdRule(parts: ThresholdRuleParts): GrafanaRule {
  return {
    uid: parts.uid,
    title: parts.title,
    condition: "C",
    data: [
      parts.query,
      {
        refId: "B",
        datasourceUid: EXPRESSION_DATASOURCE,
        relativeTimeRange: { from: 0, to: 0 },
        model: { refId: "B", type: "reduce", expression: "A", reducer: "last" },
      },
      {
        refId: "C",
        datasourceUid: EXPRESSION_DATASOURCE,
        relativeTimeRange: { from: 0, to: 0 },
        model: {
          refId: "C",
          type: "threshold",
          expression: "B",
          conditions: [{ evaluator: { type: "gt", params: [0] } }],
        },
      },
    ],
    for: parts.forDuration,
    noDataState: "OK",
    execErrState: "Error",
    labels: {
      service_namespace: parts.service.namespace,
      service_name: parts.service.name,
      deployment_environment: parts.service.environment,
    },
    annotations: { summary: parts.summary },
  };
}

function formatSelector(service: ObservedService, operator: "="): string {
  return [
    `service_namespace${operator}${quote(service.namespace)}`,
    `service_name${operator}${quote(service.name)}`,
    `deployment_environment${operator}${quote(service.environment)}`,
  ].join(",");
}

function describeService(service: ObservedService): string {
  return `${service.namespace}/${service.name} (${service.environment})`;
}

/** A uid that stays the same for the same service, so re-applying updates the rule instead of adding one. */
function deriveRuleUid(kind: string, service: ObservedService): string {
  const digest = createHash("sha256")
    .update(`${service.namespace}\n${service.name}\n${service.environment}`)
    .digest("hex")
    .slice(0, 16);
  return `${kind}-${digest}`;
}

function quote(value: string): string {
  return JSON.stringify(value);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
