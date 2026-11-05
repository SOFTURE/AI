// @ts-check
// Security alerts as issues (LT-5): the pure rules. An open alert of the Security tab (code scanning, Dependabot,
// secret scanning) becomes one issue labelled `security`, found again by a marker in its body; the issue closes when
// the alert is fixed or dismissed. `sync-alerts.mjs` reads the API and applies the plan built here.

export const SECURITY_LABEL = "security";
export const ALERT_KINDS = /** @type {const} */ (["code-scanning", "dependabot", "secret-scanning"]);

const MARKER_PATTERN = /<!-- security-alert: (code-scanning|dependabot|secret-scanning)#(\d+) -->/;
const PACKAGE_PATH = /^(?:foundation|modules|tools|themes|templates)\/([^/]+)\//;
const TITLE_LIMIT = 120;

/**
 * @typedef {typeof ALERT_KINDS[number]} AlertKind
 * @typedef {{ path: string, line: number | null }} AlertLocation
 * @typedef {{
 *   kind: AlertKind,
 *   number: number,
 *   summary: string,
 *   severity: string,
 *   url: string,
 *   location: AlertLocation | null,
 *   details: [string, string][],
 * }} Alert
 * @typedef {{ number: number, state: "open" | "closed", body: string }} AlertIssue
 * @typedef {{ kind: AlertKind, number: number }} AlertKey
 * @typedef {(
 *   | { action: "create", alert: Alert, title: string, body: string, labels: string[] }
 *   | { action: "reopen", alert: Alert, issue: number }
 *   | { action: "close", key: AlertKey, issue: number }
 * )} SyncStep
 */

/**
 * @param {unknown} value
 * @returns {Record<string, unknown>}
 */
function asRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? /** @type {Record<string, unknown>} */ (value)
    : {};
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function asText(value) {
  return typeof value === "string" ? value : "";
}

/**
 * @param {unknown} value
 * @returns {number | null}
 */
function asNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * @param {Record<string, unknown>} raw
 * @returns {number}
 */
function getAlertNumber(raw) {
  const number = asNumber(raw.number);
  if (number === null) throw new Error(`an alert without a number: ${JSON.stringify(Object.keys(raw))}`);
  return number;
}

/**
 * A code scanning alert from `GET /repos/{owner}/{repo}/code-scanning/alerts`.
 * @param {unknown} value
 * @returns {Alert}
 */
export function readCodeScanningAlert(value) {
  const raw = asRecord(value);
  const rule = asRecord(raw.rule);
  const instance = asRecord(raw.most_recent_instance);
  const location = asRecord(instance.location);
  const path = asText(location.path);
  const ruleId = asText(rule.id);
  return {
    kind: "code-scanning",
    number: getAlertNumber(raw),
    summary: asText(rule.description) || ruleId || "code scanning alert",
    severity: asText(rule.security_severity_level) || asText(rule.severity) || "unknown",
    url: asText(raw.html_url),
    location: path ? { path, line: asNumber(location.start_line) } : null,
    details: [
      ["Tool", asText(asRecord(raw.tool).name) || "unknown"],
      ["Rule", ruleId || "unknown"],
    ],
  };
}

/**
 * A Dependabot alert from `GET /repos/{owner}/{repo}/dependabot/alerts`.
 * @param {unknown} value
 * @returns {Alert}
 */
export function readDependabotAlert(value) {
  const raw = asRecord(value);
  const advisory = asRecord(raw.security_advisory);
  const vulnerability = asRecord(raw.security_vulnerability);
  const dependency = asRecord(raw.dependency);
  const pkg = asRecord(dependency.package);
  const name = asText(pkg.name) || asText(asRecord(vulnerability.package).name) || "unknown";
  const ecosystem = asText(pkg.ecosystem) || "unknown";
  const manifest = asText(dependency.manifest_path);
  const fixed = asText(asRecord(vulnerability.first_patched_version).identifier);
  return {
    kind: "dependabot",
    number: getAlertNumber(raw),
    summary: `${name}: ${asText(advisory.summary) || "vulnerable dependency"}`,
    severity: asText(vulnerability.severity) || asText(advisory.severity) || "unknown",
    url: asText(raw.html_url),
    location: manifest ? { path: manifest, line: null } : null,
    details: [
      ["Package", `${name} (${ecosystem})`],
      ["Advisory", asText(advisory.ghsa_id) || "unknown"],
      ["Vulnerable versions", asText(vulnerability.vulnerable_version_range) || "unknown"],
      ["Fixed in", fixed || "no fixed version yet"],
    ],
  };
}

/**
 * A secret scanning alert from `GET /repos/{owner}/{repo}/secret-scanning/alerts`, with its first location from
 * `.../alerts/{number}/locations`. The alert carries the secret itself (`secret`); it is never read here, so it
 * cannot reach an issue.
 * @param {unknown} value
 * @param {unknown} firstLocation
 * @returns {Alert}
 */
export function readSecretScanningAlert(value, firstLocation) {
  const raw = asRecord(value);
  const details = asRecord(asRecord(firstLocation).details);
  const path = asText(details.path);
  const secretType = asText(raw.secret_type_display_name) || asText(raw.secret_type) || "secret";
  return {
    kind: "secret-scanning",
    number: getAlertNumber(raw),
    summary: `${secretType} exposed`,
    severity: "high",
    url: asText(raw.html_url),
    location: path ? { path, line: asNumber(details.start_line) } : null,
    details: [
      ["Secret type", secretType],
      ["Validity", asText(raw.validity) || "unknown"],
    ],
  };
}

/**
 * The `pkg: <name>` label of the workspace package a path belongs to, when that label exists.
 * @param {string | undefined} path
 * @param {ReadonlySet<string>} existingLabels
 * @returns {string | null}
 */
export function getPackageLabel(path, existingLabels) {
  const name = PACKAGE_PATH.exec(path ?? "")?.[1];
  if (name === undefined) return null;
  const label = `pkg: ${name}`;
  return existingLabels.has(label) ? label : null;
}

/**
 * @param {AlertKey} key
 * @returns {string}
 */
export function formatMarker(key) {
  return `<!-- security-alert: ${key.kind}#${key.number} -->`;
}

/**
 * The alert an issue body was opened for, or null for an issue the sync did not open.
 * @param {string} body
 * @returns {AlertKey | null}
 */
export function readMarker(body) {
  const match = MARKER_PATTERN.exec(body);
  if (!match) return null;
  return { kind: /** @type {AlertKind} */ (match[1]), number: Number(match[2]) };
}

/**
 * @param {Alert} alert
 * @returns {string}
 */
export function formatIssueTitle(alert) {
  const title = `security: ${alert.kind} alert #${alert.number} (${alert.severity}): ${alert.summary}`;
  return title.length <= TITLE_LIMIT ? title : `${title.slice(0, TITLE_LIMIT - 1)}…`;
}

/**
 * @param {AlertLocation} location
 * @returns {string}
 */
function formatLocation(location) {
  return location.line === null ? `\`${location.path}\`` : `\`${location.path}\` line ${location.line}`;
}

/**
 * @param {Alert} alert
 * @returns {string}
 */
export function formatIssueBody(alert) {
  /** @type {[string, string][]} */
  const rows = [
    ["Kind", alert.kind],
    ["Severity", alert.severity],
    ...alert.details,
    ["Location", alert.location ? formatLocation(alert.location) : "not given"],
  ];
  return [
    formatMarker(alert),
    `An open ${alert.kind} alert in the Security tab: **${alert.summary}**.`,
    "",
    "| Field | Value |",
    "| --- | --- |",
    ...rows.map(([field, value]) => `| ${field} | ${value.replaceAll("|", "\\|")} |`),
    "",
    `Alert: ${alert.url}`,
    "",
    "Opened by `.github/workflows/security-alerts.yml`. It closes this issue when the alert is fixed or dismissed;",
    "the workflow never dismisses an alert. A false positive is said here, and the owner dismisses the alert.",
  ].join("\n");
}

/**
 * @param {AlertKey} key
 * @returns {string}
 */
function getKeyId(key) {
  return `${key.kind}#${key.number}`;
}

/**
 * What the sync does: create an issue for an open alert that has none, reopen a closed issue whose alert is open
 * again, and close an open issue whose alert is no longer open. Kinds that were not read (no token) are left alone,
 * so their issues neither close nor duplicate.
 * @param {{ alerts: Alert[], issues: AlertIssue[], readKinds: ReadonlySet<AlertKind>, existingLabels: ReadonlySet<string> }} input
 * @returns {SyncStep[]}
 */
export function planSync({ alerts, issues, readKinds, existingLabels }) {
  /** @type {Map<string, AlertIssue>} */
  const issueByAlert = new Map();
  for (const issue of issues) {
    const key = readMarker(issue.body);
    if (key === null) continue;
    const id = getKeyId(key);
    const known = issueByAlert.get(id);
    // A duplicate (opened by hand with a copied body) never wins over the open one.
    if (known === undefined || (known.state === "closed" && issue.state === "open")) issueByAlert.set(id, issue);
  }
  /** @type {SyncStep[]} */
  const steps = [];
  const openAlerts = new Set(alerts.map(getKeyId));
  for (const alert of alerts) {
    const issue = issueByAlert.get(getKeyId(alert));
    if (issue === undefined) {
      const packageLabel = getPackageLabel(alert.location?.path, existingLabels);
      const labels = packageLabel === null ? [SECURITY_LABEL] : [SECURITY_LABEL, packageLabel];
      steps.push({ action: "create", alert, title: formatIssueTitle(alert), body: formatIssueBody(alert), labels });
    } else if (issue.state === "closed") {
      steps.push({ action: "reopen", alert, issue: issue.number });
    }
  }
  for (const [id, issue] of issueByAlert) {
    const key = readMarker(issue.body);
    if (key === null || issue.state !== "open" || !readKinds.has(key.kind) || openAlerts.has(id)) continue;
    steps.push({ action: "close", key, issue: issue.number });
  }
  return steps;
}

/**
 * The comment that closes an issue, from the alert's current state (`fixed`, `dismissed`, `resolved`, `auto_dismissed`).
 * @param {unknown} value the alert from `GET .../{kind}/alerts/{number}`, or null when it is gone
 * @returns {string}
 */
export function formatCloseComment(value) {
  const raw = asRecord(value);
  const state = asText(raw.state) || "no longer open";
  const reason = asText(raw.dismissed_reason) || asText(raw.resolution);
  const why = reason ? ` (${reason})` : "";
  return `The alert is ${state}${why}, so this issue is closed. ${asText(raw.html_url)}`.trim();
}
