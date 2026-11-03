import { describe, expect, it } from "vitest";

import { applyGrafanaResources, DASHBOARD_MESSAGE } from "../src/node/grafana/apply.js";
import { buildServiceSilentRule } from "../src/node/grafana/rule-builders.js";
import type { GrafanaRulesFile } from "../src/node/grafana/rules-file.js";
import { createFakeGrafana } from "./fake-grafana.js";

const URL_BASE = "https://grafana.test/";
const TOKEN = "glsa_secret-token";
const WEB = buildServiceSilentRule({
  service: { namespace: "shop", name: "web", environment: "production" },
  datasourceUid: "prom",
  uid: "web-silent",
});
const WORKER = buildServiceSilentRule({
  service: { namespace: "shop", name: "worker", environment: "production" },
  datasourceUid: "prom",
  uid: "worker-silent",
});
const RULES: GrafanaRulesFile = {
  folder: { uid: "shop-alerts", title: "Shop alerts" },
  receiver: "owner-mail",
  group: "shop",
  intervalSeconds: 60,
  rules: [WEB, WORKER],
};
const DASHBOARD = { uid: "shop-overview", title: "Shop overview", id: 7, panels: [] };

describe("applyGrafanaResources", () => {
  it("only reads Grafana in a dry run and says what a commit would do", async () => {
    const grafana = createFakeGrafana({ contactPoints: ["owner-mail"] });

    const result = await applyGrafanaResources({ url: URL_BASE, token: TOKEN, rules: RULES, dashboard: DASHBOARD, fetch: grafana.fetch });

    expect(result).toEqual({
      kind: "planned",
      steps: [
        'folder "Shop alerts" (shop-alerts): will be created',
        'rule group "shop": will be replaced (add web-silent, worker-silent), 2 rules active, notifying "owner-mail"',
        'dashboard "Shop overview" (shop-overview): will be created',
      ],
    });
    expect(grafana.calls.map((call) => `${call.method} ${call.path}`)).toEqual([
      "GET /api/folders/shop-alerts",
      "GET /api/v1/provisioning/contact-points?name=owner-mail",
      "GET /api/dashboards/uid/shop-overview",
    ]);
  });

  it("creates the folder, replaces the group and upserts the dashboard on commit", async () => {
    const grafana = createFakeGrafana({ contactPoints: ["owner-mail"] });

    const result = await applyGrafanaResources({
      url: URL_BASE,
      token: TOKEN,
      rules: RULES,
      dashboard: DASHBOARD,
      commit: true,
      fetch: grafana.fetch,
    });

    expect(result).toEqual({
      kind: "applied",
      steps: [
        'folder "Shop alerts" (shop-alerts): created',
        'rule group "shop": replaced (add web-silent, worker-silent), 2 rules active, notifying "owner-mail"',
        'dashboard "Shop overview" (shop-overview): created',
      ],
    });
    const writes = grafana.calls.filter((call) => call.method !== "GET");
    expect(writes.map((call) => `${call.method} ${call.path}`)).toEqual([
      "POST /api/folders",
      "PUT /api/v1/provisioning/folder/shop-alerts/rule-groups/shop",
      "POST /api/dashboards/db",
    ]);
    expect(writes[0]?.body).toEqual({ uid: "shop-alerts", title: "Shop alerts" });
    expect(writes[1]?.headers["x-disable-provenance"]).toBe("true");
    expect(writes[1]?.body).toEqual({
      title: "shop",
      folderUid: "shop-alerts",
      interval: 60,
      rules: [WEB, WORKER].map((rule) => ({
        ...rule,
        folderUID: "shop-alerts",
        ruleGroup: "shop",
        isPaused: false,
        notification_settings: { receiver: "owner-mail" },
      })),
    });
    expect(writes[2]?.body).toEqual({
      dashboard: { ...DASHBOARD, id: null },
      folderUid: "shop-alerts",
      overwrite: true,
      message: DASHBOARD_MESSAGE,
    });
    expect(grafana.calls.every((call) => call.headers["authorization"] === `Bearer ${TOKEN}`)).toBe(true);
  });

  it("refuses without writing when the contact point does not exist", async () => {
    const grafana = createFakeGrafana({ contactPoints: ["someone-else"] });

    const result = await applyGrafanaResources({ url: URL_BASE, token: TOKEN, rules: RULES, commit: true, fetch: grafana.fetch });

    expect(result).toEqual({
      kind: "refused",
      steps: [],
      problem: 'contact point "owner-mail" does not exist in Grafana; create it there first (it is never created here)',
    });
    expect(grafana.calls.every((call) => call.method === "GET")).toBe(true);
  });

  it("names the rules a commit updates and removes, and pauses every rule with paused", async () => {
    const grafana = createFakeGrafana({
      folders: new Set(["shop-alerts"]),
      contactPoints: ["owner-mail"],
      ruleGroups: new Map([["shop-alerts/shop", { rules: [{ uid: "web-silent" }, { uid: "made-in-ui" }] }]]),
      dashboards: new Set(["shop-overview"]),
    });

    const result = await applyGrafanaResources({
      url: URL_BASE,
      token: TOKEN,
      rules: RULES,
      dashboard: DASHBOARD,
      commit: true,
      paused: true,
      fetch: grafana.fetch,
    });

    expect(result).toEqual({
      kind: "applied",
      steps: [
        'rule group "shop": replaced (add worker-silent; update web-silent; remove made-in-ui), 2 rules paused, notifying "owner-mail"',
        'dashboard "Shop overview" (shop-overview): updated',
      ],
    });
    const group = grafana.state.ruleGroups.get("shop-alerts/shop") as unknown as { rules: { isPaused: boolean }[] };
    expect(group.rules.map((rule) => rule.isPaused)).toEqual([true, true]);
  });

  it("names the call and the status when Grafana fails, never the token", async () => {
    const grafana = createFakeGrafana({
      contactPoints: ["owner-mail"],
      failures: new Map([["PUT /api/v1/provisioning/folder/shop-alerts/rule-groups/shop", 400]]),
    });

    const result = await applyGrafanaResources({ url: URL_BASE, token: TOKEN, rules: RULES, commit: true, fetch: grafana.fetch });

    expect(result).toEqual({
      kind: "failed",
      steps: ['folder "Shop alerts" (shop-alerts): created'],
      problem: 'PUT /api/v1/provisioning/folder/shop-alerts/rule-groups/shop failed with HTTP 400: {"message":"forced failure"}',
    });
  });

  it("fails on a folder read it cannot interpret", async () => {
    const grafana = createFakeGrafana({ failures: new Map([["GET /api/folders/shop-alerts", 403]]) });

    const result = await applyGrafanaResources({ url: URL_BASE, token: TOKEN, rules: RULES, fetch: grafana.fetch });

    expect(result).toEqual({
      kind: "failed",
      steps: [],
      problem: 'GET /api/folders/shop-alerts failed with HTTP 403: {"message":"forced failure"}',
    });
  });

  it("reports an unreachable Grafana by its URL", async () => {
    const unreachable = (() => Promise.reject(new TypeError("fetch failed"))) as typeof fetch;

    const result = await applyGrafanaResources({ url: URL_BASE, token: TOKEN, rules: RULES, fetch: unreachable });

    expect(result).toEqual({ kind: "failed", steps: [], problem: `Grafana at ${URL_BASE} is unreachable: fetch failed` });
  });
});
