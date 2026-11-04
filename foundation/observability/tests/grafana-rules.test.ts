import { describe, expect, it } from "vitest";

import { buildLogProblemsRule, buildServiceSilentRule } from "../src/node/grafana/rule-builders.js";
import { parseGrafanaDashboard, parseGrafanaRulesFile } from "../src/node/grafana/rules-file.js";

const SERVICE = { namespace: "shop", name: "web", environment: "production" };
const WORKER = { namespace: "shop", name: "worker", environment: "production" };

function validFile(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    folder: { uid: "shop-alerts", title: "Shop alerts" },
    receiver: "owner-mail",
    group: "shop",
    rules: [buildServiceSilentRule({ service: SERVICE, datasourceUid: "prom" })],
    ...overrides,
  };
}

describe("parseGrafanaRulesFile", () => {
  it("accepts a file and defaults the interval to 60 seconds", () => {
    const parsed = parseGrafanaRulesFile(validFile());

    expect(parsed.isValid).toBe(true);
    expect(parsed.isValid && parsed.value.intervalSeconds).toBe(60);
  });

  it("keeps the rule fields it does not check", () => {
    const parsed = parseGrafanaRulesFile(validFile());

    expect(parsed.isValid && parsed.value.rules[0]?.["noDataState"]).toBe("OK");
  });

  it("names a duplicate uid, a condition without its query and a bad interval", () => {
    const rule = buildServiceSilentRule({ service: SERVICE, datasourceUid: "prom" });

    const parsed = parseGrafanaRulesFile(
      validFile({ intervalSeconds: 45, rules: [rule, { ...rule, title: "Copy", condition: "Z" }] }),
    );

    expect(parsed).toEqual({
      isValid: false,
      problems: [
        "intervalSeconds: intervalSeconds must be a multiple of 10",
        `rules.1.uid: duplicate rule uid "${rule.uid}"`,
        'rules.1.condition: condition "Z" names no refId of the rule\'s data',
      ],
    });
  });

  it("refuses an empty rule list and a missing receiver", () => {
    const parsed = parseGrafanaRulesFile(validFile({ receiver: undefined, rules: [] }));

    expect(parsed.isValid).toBe(false);
    expect(parsed.isValid ? [] : parsed.problems.map((problem) => problem.split(":")[0])).toEqual(["receiver", "rules"]);
  });

  it("refuses a dashboard without a uid", () => {
    expect(parseGrafanaDashboard({ title: "Shop" }).isValid).toBe(false);
    expect(parseGrafanaDashboard({ uid: "shop", title: "Shop", panels: [] }).isValid).toBe(true);
  });
});

describe("buildServiceSilentRule", () => {
  it("fires when target_info of the service is absent for the window", () => {
    const rule = buildServiceSilentRule({ service: SERVICE, datasourceUid: "prom" });

    expect(rule.data[0]).toEqual({
      refId: "A",
      datasourceUid: "prom",
      relativeTimeRange: { from: 600, to: 0 },
      model: {
        refId: "A",
        expr: 'absent_over_time(target_info{service_namespace="shop",service_name="web",deployment_environment="production"}[10m])',
        instant: true,
        range: false,
      },
    });
    expect(rule.title).toBe("shop/web (production) is silent");
    expect(rule["noDataState"]).toBe("OK");
    expect(rule.condition).toBe("C");
  });

  it("gives the same service the same uid and another service another one", () => {
    const first = buildServiceSilentRule({ service: SERVICE, datasourceUid: "prom" });
    const again = buildServiceSilentRule({ service: { ...SERVICE }, datasourceUid: "other", windowMinutes: 3 });
    const worker = buildServiceSilentRule({ service: WORKER, datasourceUid: "prom" });

    expect(again.uid).toBe(first.uid);
    expect(worker.uid).not.toBe(first.uid);
    expect(first.uid).toMatch(/^silent-[0-9a-f]{16}$/);
  });

  it("takes a uid, a title, a window and a pending period", () => {
    const rule = buildServiceSilentRule({
      service: WORKER,
      datasourceUid: "prom",
      windowMinutes: 30,
      for: "5m",
      uid: "worker-silent",
      title: "Worker is silent",
    });

    expect(rule).toMatchObject({ uid: "worker-silent", title: "Worker is silent", for: "5m" });
    expect(rule.data[0]?.relativeTimeRange).toEqual({ from: 1800, to: 0 });
  });
});

describe("buildLogProblemsRule", () => {
  it("counts the service's WARN and ERROR records in Loki", () => {
    const rule = buildLogProblemsRule({ service: SERVICE, datasourceUid: "loki" });

    expect(rule.data[0]?.model).toEqual({
      refId: "A",
      expr: 'sum(count_over_time({service_namespace="shop",service_name="web",deployment_environment="production"} | severity_text=~"WARN|ERROR" [5m]))',
      queryType: "instant",
    });
    expect(rule.title).toBe("shop/web (production) logs WARN or ERROR");
    expect(rule.uid).toMatch(/^logs-[0-9a-f]{16}$/);
  });

  it("escapes quotes in names and takes other severities", () => {
    const rule = buildLogProblemsRule({
      service: { namespace: 'a"b', name: "web", environment: "prod" },
      datasourceUid: "loki",
      severities: ["ERROR"],
    });

    expect(rule.data[0]?.model["expr"]).toBe(
      'sum(count_over_time({service_namespace="a\\"b",service_name="web",deployment_environment="prod"} | severity_text=~"ERROR" [5m]))',
    );
  });

  it("refuses an empty severity list", () => {
    expect(() => buildLogProblemsRule({ service: SERVICE, datasourceUid: "loki", severities: [] })).toThrow(
      "buildLogProblemsRule: severities is empty",
    );
  });

  it("builds rules a rules file accepts", () => {
    const parsed = parseGrafanaRulesFile(
      validFile({
        rules: [
          buildServiceSilentRule({ service: SERVICE, datasourceUid: "prom" }),
          buildServiceSilentRule({ service: WORKER, datasourceUid: "prom" }),
          buildLogProblemsRule({ service: SERVICE, datasourceUid: "loki" }),
        ],
      }),
    );

    expect(parsed.isValid).toBe(true);
  });
});
