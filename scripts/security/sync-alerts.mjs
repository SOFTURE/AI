// @ts-check
// Security alerts as issues (LT-5): reads the open alerts and the `security` issues through the REST API and
// applies the plan of `alert-issues.mjs`. Run by `.github/workflows/security-alerts.yml`.
//
// Environment:
//   GITHUB_REPOSITORY      owner/repo
//   GITHUB_TOKEN           issues (write) and code scanning alerts (read)
//   SECURITY_ALERTS_TOKEN  Dependabot and secret scanning alerts (read); when empty those two kinds are skipped
//                          with a warning, and their issues stay as they are
//   DRY_RUN                "true" prints the plan without writing
import {
  SECURITY_LABEL,
  formatCloseComment,
  planSync,
  readCodeScanningAlert,
  readDependabotAlert,
  readSecretScanningAlert,
} from "./alert-issues.mjs";

const API = "https://api.github.com";
const ALERTS_SECRET = "SECURITY_ALERTS_TOKEN";

/**
 * @typedef {import("./alert-issues.mjs").Alert} Alert
 * @typedef {import("./alert-issues.mjs").AlertKind} AlertKind
 * @typedef {import("./alert-issues.mjs").AlertIssue} AlertIssue
 */

/**
 * @param {string} name
 * @returns {string}
 */
function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`sync-alerts: the environment variable ${name} is empty`);
  return value;
}

/**
 * @param {string} token
 * @param {string} path
 * @param {{ method?: string, body?: unknown, allowMissing?: boolean }} [options]
 * @returns {Promise<{ data: unknown, next: string | null }>}
 */
async function callApi(token, path, options = {}) {
  const url = path.startsWith("https://") ? path : `${API}${path}`;
  const response = await fetch(url, {
    method: options.method ?? "GET",
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "x-github-api-version": "2022-11-28",
      ...(options.body === undefined ? {} : { "content-type": "application/json" }),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  if (options.allowMissing && response.status === 404) return { data: null, next: null };
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${options.method ?? "GET"} ${url} failed: ${response.status} ${text.slice(0, 300)}`);
  }
  const next = /<([^>]+)>;\s*rel="next"/.exec(response.headers.get("link") ?? "")?.[1] ?? null;
  return { data: response.status === 204 ? null : await response.json(), next };
}

/**
 * Every item of a paged list.
 * @param {string} token
 * @param {string} path
 * @returns {Promise<unknown[]>}
 */
async function listAll(token, path) {
  /** @type {unknown[]} */
  const items = [];
  /** @type {string | null} */
  let next = path;
  while (next !== null) {
    const page = await callApi(token, next);
    /** @type {unknown} */
    const data = page.data;
    if (!Array.isArray(data)) throw new Error(`GET ${next} did not return a list`);
    /** @type {unknown[]} */
    const list = data;
    items.push(...list);
    next = page.next;
  }
  return items;
}

/**
 * @param {string} message
 */
function warn(message) {
  console.log(`::warning::${message}`);
}

/**
 * @param {string} repo
 * @param {string} token
 * @returns {Promise<Alert[]>}
 */
async function listCodeScanningAlerts(repo, token) {
  const raw = await listAll(token, `/repos/${repo}/code-scanning/alerts?state=open&per_page=100`);
  return raw.map(readCodeScanningAlert);
}

/**
 * @param {string} repo
 * @param {string} token
 * @returns {Promise<Alert[]>}
 */
async function listDependabotAlerts(repo, token) {
  const raw = await listAll(token, `/repos/${repo}/dependabot/alerts?state=open&per_page=100`);
  return raw.map(readDependabotAlert);
}

/**
 * @param {string} repo
 * @param {string} token
 * @returns {Promise<Alert[]>}
 */
async function listSecretScanningAlerts(repo, token) {
  const raw = await listAll(token, `/repos/${repo}/secret-scanning/alerts?state=open&per_page=100`);
  /** @type {Alert[]} */
  const alerts = [];
  for (const item of raw) {
    const number = /** @type {{ number?: unknown }} */ (item).number;
    const locations = await callApi(token, `/repos/${repo}/secret-scanning/alerts/${String(number)}/locations?per_page=1`);
    /** @type {unknown} */
    const first = Array.isArray(locations.data) ? /** @type {unknown[]} */ (locations.data)[0] : null;
    alerts.push(readSecretScanningAlert(item, first));
  }
  return alerts;
}

/**
 * @param {string} repo
 * @param {string} token
 * @returns {Promise<AlertIssue[]>}
 */
async function listAlertIssues(repo, token) {
  const raw = await listAll(token, `/repos/${repo}/issues?labels=${SECURITY_LABEL}&state=all&per_page=100`);
  return raw.flatMap((item) => {
    const issue = /** @type {{ number?: unknown, state?: unknown, body?: unknown, pull_request?: unknown }} */ (item);
    if (issue.pull_request !== undefined || typeof issue.number !== "number") return [];
    return [{ number: issue.number, state: issue.state === "closed" ? "closed" : "open", body: typeof issue.body === "string" ? issue.body : "" }];
  });
}

/**
 * @param {string} repo
 * @param {string} token
 * @returns {Promise<Set<string>>}
 */
async function listLabels(repo, token) {
  const raw = await listAll(token, `/repos/${repo}/labels?per_page=100`);
  return new Set(raw.map((label) => String(/** @type {{ name?: unknown }} */ (label).name)));
}

async function main() {
  const repo = requireEnv("GITHUB_REPOSITORY");
  const issuesToken = requireEnv("GITHUB_TOKEN");
  const alertsToken = process.env[ALERTS_SECRET]?.trim() ?? "";
  const isDryRun = process.env.DRY_RUN === "true";

  /** @type {Alert[]} */
  const alerts = await listCodeScanningAlerts(repo, issuesToken);
  /** @type {Set<AlertKind>} */
  const readKinds = new Set(["code-scanning"]);
  /** @type {Record<AlertKind, string>} */
  const tokens = { "code-scanning": issuesToken, dependabot: alertsToken, "secret-scanning": alertsToken };
  if (alertsToken) {
    // A token that is set but refused fails the run here: that is a wrong token, not a missing one.
    alerts.push(...(await listDependabotAlerts(repo, alertsToken)));
    alerts.push(...(await listSecretScanningAlerts(repo, alertsToken)));
    readKinds.add("dependabot");
    readKinds.add("secret-scanning");
  } else {
    warn(
      `The repository secret ${ALERTS_SECRET} is not set, so Dependabot and secret scanning alerts were not read ` +
        "and their issues were left as they are. Code scanning alerts were synced.",
    );
  }

  const steps = planSync({
    alerts,
    issues: await listAlertIssues(repo, issuesToken),
    readKinds,
    existingLabels: await listLabels(repo, issuesToken),
  });
  console.log(`Read ${alerts.length} open alerts (${[...readKinds].join(", ")}); ${steps.length} issue changes.`);

  for (const step of steps) {
    if (step.action === "create") {
      console.log(`create: ${step.title}`);
      if (isDryRun) continue;
      await callApi(issuesToken, `/repos/${repo}/issues`, {
        method: "POST",
        body: { title: step.title, body: step.body, labels: step.labels },
      });
    } else if (step.action === "reopen") {
      console.log(`reopen #${step.issue}: ${step.alert.kind} alert #${step.alert.number} is open again`);
      if (isDryRun) continue;
      await callApi(issuesToken, `/repos/${repo}/issues/${step.issue}/comments`, {
        method: "POST",
        body: { body: `The alert is open again, so this issue is reopened. ${step.alert.url}`.trim() },
      });
      await callApi(issuesToken, `/repos/${repo}/issues/${step.issue}`, { method: "PATCH", body: { state: "open" } });
    } else {
      console.log(`close #${step.issue}: ${step.key.kind} alert #${step.key.number} is no longer open`);
      if (isDryRun) continue;
      const alert = await callApi(tokens[step.key.kind], `/repos/${repo}/${step.key.kind}/alerts/${step.key.number}`, {
        allowMissing: true,
      });
      await callApi(issuesToken, `/repos/${repo}/issues/${step.issue}/comments`, {
        method: "POST",
        body: { body: formatCloseComment(alert.data) },
      });
      await callApi(issuesToken, `/repos/${repo}/issues/${step.issue}`, {
        method: "PATCH",
        body: { state: "closed", state_reason: "completed" },
      });
    }
  }
}

main().catch((/** @type {unknown} */ error) => {
  console.error(`::error::${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
