import type { GrafanaDashboard, GrafanaRulesFile } from "./rules-file.js";

export type ApplyGrafanaOptions = {
  /** Base URL of the Grafana instance, e.g. `https://example.grafana.net`. */
  url: string;
  /** A service account token with the rights to read and write folders, alert rules and dashboards. */
  token: string;
  rules: GrafanaRulesFile;
  /** Upserted into the rules file's folder. */
  dashboard?: GrafanaDashboard;
  /** `false` (the default) only reads Grafana and returns what a commit would do. */
  commit?: boolean;
  /** Every rule is applied paused, e.g. before the first release that sends telemetry. */
  paused?: boolean;
  /** Default: the global `fetch`. */
  fetch?: typeof fetch;
};

export type GrafanaApplyResult =
  /** `steps` say what was done. */
  | { kind: "applied"; steps: string[] }
  /** Dry run: `steps` say what a commit would do. */
  | { kind: "planned"; steps: string[] }
  /** Nothing was written; `problem` says why. */
  | { kind: "refused"; steps: string[]; problem: string }
  /** A Grafana call failed; `steps` holds what was done before it. */
  | { kind: "failed"; steps: string[]; problem: string };

type GrafanaClient = {
  request(method: string, path: string, body?: unknown): Promise<GrafanaResponse>;
};

type GrafanaResponse = { status: number; body: unknown; text: string };

type GrafanaRuleGroupBody = { rules?: { uid?: unknown }[] };

export const DASHBOARD_MESSAGE = "Applied by softure-observability";

/**
 * Applies a rules file (and a dashboard) to Grafana: creates the folder when it is missing, refuses when the
 * contact point does not exist, replaces the rule group in one `PUT` and upserts the dashboard. Without `commit`
 * it only reads.
 */
export async function applyGrafanaResources(options: ApplyGrafanaOptions): Promise<GrafanaApplyResult> {
  const client = createClient(options);
  const { rules } = options;
  const steps: string[] = [];
  const isCommit = options.commit === true;

  try {
    const folderPath = `/api/folders/${encodeURIComponent(rules.folder.uid)}`;
    const folder = await client.request("GET", folderPath);
    const hasFolder = folder.status === 200;
    if (!hasFolder && folder.status !== 404) {
      return failed(steps, describeFailure("GET", folderPath, folder));
    }

    const contactPath = `/api/v1/provisioning/contact-points?name=${encodeURIComponent(rules.receiver)}`;
    const contacts = await client.request("GET", contactPath);
    if (contacts.status !== 200) {
      return failed(steps, describeFailure("GET", "/api/v1/provisioning/contact-points", contacts));
    }
    if (!hasContactPoint(contacts.body, rules.receiver)) {
      return {
        kind: "refused",
        steps,
        problem: `contact point "${rules.receiver}" does not exist in Grafana; create it there first (it is never created here)`,
      };
    }

    const groupPath = `/api/v1/provisioning/folder/${encodeURIComponent(rules.folder.uid)}/rule-groups/${encodeURIComponent(rules.group)}`;
    const existingUids = hasFolder ? await readRuleUids(client, groupPath) : [];
    if (typeof existingUids === "string") {
      return failed(steps, existingUids);
    }

    const dashboardState = options.dashboard === undefined ? undefined : await readDashboardState(client, options.dashboard);
    if (dashboardState?.kind === "failed") {
      return failed(steps, dashboardState.problem);
    }

    if (!hasFolder) {
      if (isCommit) {
        const created = await client.request("POST", "/api/folders", { uid: rules.folder.uid, title: rules.folder.title });
        if (created.status !== 200) {
          return failed(steps, describeFailure("POST", "/api/folders", created));
        }
      }
      steps.push(`folder "${rules.folder.title}" (${rules.folder.uid}): ${isCommit ? "created" : "will be created"}`);
    }

    steps.push(describeGroupChange(rules, existingUids, options.paused === true, isCommit));
    if (isCommit) {
      const replaced = await client.request("PUT", groupPath, buildRuleGroupBody(rules, options.paused === true));
      if (replaced.status !== 200) {
        steps.pop();
        return failed(steps, describeFailure("PUT", groupPath, replaced));
      }
    }

    if (options.dashboard !== undefined && dashboardState !== undefined) {
      const verb = dashboardState.kind === "exists" ? "updated" : "created";
      const label = `dashboard "${options.dashboard.title}" (${options.dashboard.uid})`;
      if (isCommit) {
        const saved = await client.request("POST", "/api/dashboards/db", {
          dashboard: { ...options.dashboard, id: null },
          folderUid: rules.folder.uid,
          overwrite: true,
          message: DASHBOARD_MESSAGE,
        });
        if (saved.status !== 200) {
          return failed(steps, describeFailure("POST", "/api/dashboards/db", saved));
        }
        steps.push(`${label}: ${verb}`);
      } else {
        steps.push(`${label}: will be ${verb}`);
      }
    }
  } catch (error) {
    return failed(steps, `Grafana at ${options.url} is unreachable: ${error instanceof Error ? error.message : String(error)}`);
  }

  return isCommit ? { kind: "applied", steps } : { kind: "planned", steps };
}

/** The body of the rule group `PUT`: every rule notifies the file's receiver and sits in its folder and group. */
export function buildRuleGroupBody(rules: GrafanaRulesFile, paused: boolean): Record<string, unknown> {
  return {
    title: rules.group,
    folderUid: rules.folder.uid,
    interval: rules.intervalSeconds,
    rules: rules.rules.map((rule) => ({
      ...rule,
      folderUID: rules.folder.uid,
      ruleGroup: rules.group,
      isPaused: paused || rule["isPaused"] === true,
      notification_settings: { receiver: rules.receiver },
    })),
  };
}

function createClient(options: ApplyGrafanaOptions): GrafanaClient {
  const baseUrl = trimTrailingSlashes(options.url);
  const fetchImpl = options.fetch ?? fetch;
  return {
    async request(method, path, body) {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${options.token}`,
        Accept: "application/json",
      };
      if (body !== undefined) {
        headers["Content-Type"] = "application/json";
      }
      if (method === "PUT") {
        // Keeps the provisioned rules editable in the Grafana UI.
        headers["X-Disable-Provenance"] = "true";
      }
      const init: RequestInit = { method, headers };
      if (body !== undefined) {
        init.body = JSON.stringify(body);
      }
      const response = await fetchImpl(`${baseUrl}${path}`, init);
      const text = await response.text();
      return { status: response.status, text, body: parseJson(text) };
    },
  };
}

async function readRuleUids(client: GrafanaClient, groupPath: string): Promise<string[] | string> {
  const group = await client.request("GET", groupPath);
  if (group.status === 404) {
    return [];
  }
  if (group.status !== 200) {
    return describeFailure("GET", groupPath, group);
  }
  const existing = (group.body ?? {}) as GrafanaRuleGroupBody;
  return (existing.rules ?? []).flatMap((rule) => (typeof rule.uid === "string" ? [rule.uid] : []));
}

type DashboardState = { kind: "exists" } | { kind: "missing" } | { kind: "failed"; problem: string };

async function readDashboardState(client: GrafanaClient, dashboard: GrafanaDashboard): Promise<DashboardState> {
  const path = `/api/dashboards/uid/${encodeURIComponent(dashboard.uid)}`;
  const response = await client.request("GET", path);
  if (response.status === 200) {
    return { kind: "exists" };
  }
  if (response.status === 404) {
    return { kind: "missing" };
  }
  return { kind: "failed", problem: describeFailure("GET", path, response) };
}

function describeGroupChange(rules: GrafanaRulesFile, existingUids: readonly string[], paused: boolean, isCommit: boolean): string {
  const wanted = rules.rules.map((rule) => rule.uid);
  const existing = new Set(existingUids);
  const added = wanted.filter((uid) => !existing.has(uid));
  const updated = wanted.filter((uid) => existing.has(uid));
  const removed = existingUids.filter((uid) => !wanted.includes(uid));
  const parts = [
    added.length > 0 ? `add ${added.join(", ")}` : undefined,
    updated.length > 0 ? `update ${updated.join(", ")}` : undefined,
    removed.length > 0 ? `remove ${removed.join(", ")}` : undefined,
  ].filter((part) => part !== undefined);
  const state = paused ? "paused" : "active";
  const verb = isCommit ? "replaced" : "will be replaced";
  return `rule group "${rules.group}": ${verb} (${parts.join("; ")}), ${String(wanted.length)} ${wanted.length === 1 ? "rule" : "rules"} ${state}, notifying "${rules.receiver}"`;
}

function hasContactPoint(body: unknown, name: string): boolean {
  return Array.isArray(body) && body.some((entry) => typeof entry === "object" && entry !== null && (entry as { name?: unknown }).name === name);
}

function describeFailure(method: string, path: string, response: GrafanaResponse): string {
  const detail = response.text.trim().slice(0, 300);
  const pathOnly = path.split("?")[0] ?? path;
  return `${method} ${pathOnly} failed with HTTP ${String(response.status)}${detail === "" ? "" : `: ${detail}`}`;
}

function failed(steps: string[], problem: string): GrafanaApplyResult {
  return { kind: "failed", steps, problem };
}

function trimTrailingSlashes(url: string): string {
  let end = url.length;
  while (end > 0 && url[end - 1] === "/") {
    end -= 1;
  }
  return url.slice(0, end);
}

function parseJson(text: string): unknown {
  if (text === "") {
    return undefined;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    // Not JSON (an HTML error page, a plain-text message): the caller reports `text` instead.
    return undefined;
  }
}
