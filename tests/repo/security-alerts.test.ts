import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import {
  formatCloseComment,
  formatIssueBody,
  formatIssueTitle,
  formatMarker,
  getPackageLabel,
  planSync,
  readCodeScanningAlert,
  readDependabotAlert,
  readMarker,
  readSecretScanningAlert,
  type Alert,
  type AlertIssue,
  type AlertKind,
} from "../../scripts/security/alert-issues.mjs";
import { REPO_ROOT } from "./repo-files.js";

// Security alerts as issues (LT-5): one issue per open alert, found again by its marker, closed when the alert is no
// longer open; a secret never reaches the issue text. No network: the API shapes are built here.

const ALL_KINDS: ReadonlySet<AlertKind> = new Set(["code-scanning", "dependabot", "secret-scanning"]);
const LABELS: ReadonlySet<string> = new Set(["security", "pkg: auth", "pkg: marketing-kit"]);
const SECRET = "ghp_aVeryRealLookingSecretValue1234567890";

function buildCodeScanning(number: number, path = "modules/auth/src/session.ts"): unknown {
  return {
    number,
    html_url: `https://github.com/SOFTURE/AI/security/code-scanning/${number}`,
    rule: { id: "js/sql-injection", severity: "error", security_severity_level: "high", description: "SQL injection" },
    tool: { name: "CodeQL" },
    most_recent_instance: { location: { path, start_line: 42 } },
  };
}

function buildDependabot(number: number): unknown {
  return {
    number,
    html_url: `https://github.com/SOFTURE/AI/security/dependabot/${number}`,
    dependency: { package: { ecosystem: "npm", name: "next" }, manifest_path: "package-lock.json" },
    security_advisory: { ghsa_id: "GHSA-abcd-efgh-ijkl", summary: "Cache poisoning", severity: "high" },
    security_vulnerability: {
      severity: "high",
      vulnerable_version_range: ">= 16.0.0, < 16.3.9",
      first_patched_version: { identifier: "16.3.9" },
    },
  };
}

function buildSecret(number: number): unknown {
  return {
    number,
    html_url: `https://github.com/SOFTURE/AI/security/secret-scanning/${number}`,
    secret_type: "github_personal_access_token",
    secret_type_display_name: "GitHub Personal Access Token",
    secret: SECRET,
    validity: "active",
  };
}

const SECRET_LOCATION = { type: "commit", details: { path: "tools/marketing-kit/.env.example", start_line: 3 } };

function buildIssue(number: number, alert: Alert, state: "open" | "closed" = "open"): AlertIssue {
  return { number, state, body: formatIssueBody(alert) };
}

describe("reading alerts", () => {
  it("reads a code scanning alert with its rule, severity and location", () => {
    const alert = readCodeScanningAlert(buildCodeScanning(7));
    expect(alert).toEqual({
      kind: "code-scanning",
      number: 7,
      summary: "SQL injection",
      severity: "high",
      url: "https://github.com/SOFTURE/AI/security/code-scanning/7",
      location: { path: "modules/auth/src/session.ts", line: 42 },
      details: [
        ["Tool", "CodeQL"],
        ["Rule", "js/sql-injection"],
      ],
    });
  });

  it("reads a Dependabot alert with the package, the advisory and the fixed version", () => {
    const alert = readDependabotAlert(buildDependabot(3));
    expect(alert.summary).toBe("next: Cache poisoning");
    expect(alert.severity).toBe("high");
    expect(alert.location).toEqual({ path: "package-lock.json", line: null });
    expect(alert.details).toEqual([
      ["Package", "next (npm)"],
      ["Advisory", "GHSA-abcd-efgh-ijkl"],
      ["Vulnerable versions", ">= 16.0.0, < 16.3.9"],
      ["Fixed in", "16.3.9"],
    ]);
  });

  it("reads a Dependabot alert without a fixed version", () => {
    const raw = buildDependabot(4) as { security_vulnerability: Record<string, unknown> };
    raw.security_vulnerability.first_patched_version = null;
    expect(readDependabotAlert(raw).details).toContainEqual(["Fixed in", "no fixed version yet"]);
  });

  it("reads a secret scanning alert with its type and location, never the secret", () => {
    const alert = readSecretScanningAlert(buildSecret(2), SECRET_LOCATION);
    expect(alert.summary).toBe("GitHub Personal Access Token exposed");
    expect(alert.location).toEqual({ path: "tools/marketing-kit/.env.example", line: 3 });
    expect(JSON.stringify(alert)).not.toContain(SECRET);
    expect(formatIssueBody(alert)).not.toContain(SECRET);
    expect(formatIssueTitle(alert)).not.toContain(SECRET);
  });

  it("reads a secret scanning alert without a location", () => {
    expect(readSecretScanningAlert(buildSecret(5), undefined).location).toBeNull();
  });

  it("fails on an alert without a number", () => {
    expect(() => readCodeScanningAlert({ rule: {} })).toThrow(/without a number/);
  });
});

describe("issue text", () => {
  it("round-trips the marker through the body", () => {
    const alert = readDependabotAlert(buildDependabot(12));
    expect(formatMarker(alert)).toBe("<!-- security-alert: dependabot#12 -->");
    expect(readMarker(formatIssueBody(alert))).toEqual({ kind: "dependabot", number: 12 });
    expect(readMarker("A hand-written security issue")).toBeNull();
  });

  it("names the kind, severity, location and link in the body", () => {
    const body = formatIssueBody(readCodeScanningAlert(buildCodeScanning(7)));
    expect(body).toContain("| Kind | code-scanning |");
    expect(body).toContain("| Severity | high |");
    expect(body).toContain("| Location | `modules/auth/src/session.ts` line 42 |");
    expect(body).toContain("Alert: https://github.com/SOFTURE/AI/security/code-scanning/7");
  });

  it("escapes a pipe in a table value", () => {
    const body = formatIssueBody(readDependabotAlert(buildDependabot(3)));
    expect(body).toContain("| Vulnerable versions | >= 16.0.0, < 16.3.9 |");
    const piped = readCodeScanningAlert({ ...(buildCodeScanning(8) as object), tool: { name: "a|b" } });
    expect(formatIssueBody(piped)).toContain("| Tool | a\\|b |");
  });

  it("titles the issue with the kind, number and severity, within 120 characters", () => {
    expect(formatIssueTitle(readDependabotAlert(buildDependabot(3)))).toBe(
      "security: dependabot alert #3 (high): next: Cache poisoning",
    );
    const long = readCodeScanningAlert({
      ...(buildCodeScanning(9) as object),
      rule: { id: "x", severity: "warning", description: "word ".repeat(60) },
    });
    expect(formatIssueTitle(long)).toHaveLength(120);
  });

  it("explains the closing state and reason", () => {
    expect(formatCloseComment({ state: "dismissed", dismissed_reason: "false positive", html_url: "https://x/1" })).toBe(
      "The alert is dismissed (false positive), so this issue is closed. https://x/1",
    );
    expect(formatCloseComment({ state: "fixed", html_url: "https://x/2" })).toBe(
      "The alert is fixed, so this issue is closed. https://x/2",
    );
    expect(formatCloseComment(null)).toBe("The alert is no longer open, so this issue is closed.");
  });
});

describe("getPackageLabel", () => {
  it("labels a path inside a workspace package whose label exists", () => {
    expect(getPackageLabel("modules/auth/src/session.ts", LABELS)).toBe("pkg: auth");
    expect(getPackageLabel("tools/marketing-kit/.env.example", LABELS)).toBe("pkg: marketing-kit");
  });

  it("gives no label outside the packages, for a missing label, or without a path", () => {
    expect(getPackageLabel("package-lock.json", LABELS)).toBeNull();
    expect(getPackageLabel(".github/workflows/ci.yml", LABELS)).toBeNull();
    expect(getPackageLabel("modules/billing/src/index.ts", LABELS)).toBeNull();
    expect(getPackageLabel(undefined, LABELS)).toBeNull();
  });
});

describe("planSync", () => {
  const codeScanning = readCodeScanningAlert(buildCodeScanning(7));
  const dependabot = readDependabotAlert(buildDependabot(3));
  const secret = readSecretScanningAlert(buildSecret(2), SECRET_LOCATION);

  it("creates one issue per open alert that has none, labelled security and its package", () => {
    const steps = planSync({ alerts: [codeScanning, dependabot], issues: [], readKinds: ALL_KINDS, existingLabels: LABELS });
    expect(steps.map((step) => step.action)).toEqual(["create", "create"]);
    expect(steps[0]).toMatchObject({ action: "create", labels: ["security", "pkg: auth"] });
    expect(steps[1]).toMatchObject({ action: "create", labels: ["security"] });
  });

  it("creates nothing on a re-run", () => {
    const issues = [buildIssue(100, codeScanning), buildIssue(101, dependabot), buildIssue(102, secret)];
    const steps = planSync({ alerts: [codeScanning, dependabot, secret], issues, readKinds: ALL_KINDS, existingLabels: LABELS });
    expect(steps).toEqual([]);
  });

  it("closes the open issue of an alert that is no longer open", () => {
    const issues = [buildIssue(100, codeScanning), buildIssue(101, dependabot)];
    const steps = planSync({ alerts: [codeScanning], issues, readKinds: ALL_KINDS, existingLabels: LABELS });
    expect(steps).toEqual([{ action: "close", key: { kind: "dependabot", number: 3 }, issue: 101 }]);
  });

  it("leaves the issues of a kind it could not read alone", () => {
    const issues = [buildIssue(101, dependabot), buildIssue(102, secret)];
    const steps = planSync({
      alerts: [],
      issues,
      readKinds: new Set<AlertKind>(["code-scanning"]),
      existingLabels: LABELS,
    });
    expect(steps).toEqual([]);
  });

  it("reopens the closed issue of an alert that is open again", () => {
    const steps = planSync({
      alerts: [dependabot],
      issues: [buildIssue(101, dependabot, "closed")],
      readKinds: ALL_KINDS,
      existingLabels: LABELS,
    });
    expect(steps).toEqual([{ action: "reopen", alert: dependabot, issue: 101 }]);
  });

  it("does not reopen when an open issue for the same alert exists beside a closed copy", () => {
    const steps = planSync({
      alerts: [dependabot],
      issues: [buildIssue(101, dependabot, "closed"), buildIssue(105, dependabot)],
      readKinds: ALL_KINDS,
      existingLabels: LABELS,
    });
    expect(steps).toEqual([]);
  });

  it("ignores security issues without a marker", () => {
    const steps = planSync({
      alerts: [],
      issues: [{ number: 50, state: "open", body: "Found by hand" }],
      readKinds: ALL_KINDS,
      existingLabels: LABELS,
    });
    expect(steps).toEqual([]);
  });
});

describe(".github/workflows/security-alerts.yml", () => {
  interface Workflow {
    on: { schedule?: { cron: string }[]; workflow_dispatch?: unknown };
    permissions: Record<string, string>;
    jobs: Record<string, { "timeout-minutes"?: number; steps: { run?: string; env?: Record<string, string> }[] }>;
  }
  const workflow = parse(
    readFileSync(join(REPO_ROOT, ".github/workflows/security-alerts.yml"), "utf8"),
  ) as Workflow;

  it("runs hourly before the coordinator's issue check at :39, and on demand", () => {
    expect(workflow.on.schedule).toEqual([{ cron: "17 * * * *" }]);
    expect("workflow_dispatch" in workflow.on).toBe(true);
  });

  it("writes only issues and reads alerts", () => {
    expect(workflow.permissions).toEqual({ contents: "read", issues: "write", "security-events": "read" });
  });

  it("runs the sync script with the alerts secret", () => {
    const step = Object.values(workflow.jobs).flatMap((job) => job.steps).find((candidate) => candidate.run);
    expect(step?.run).toBe("node scripts/security/sync-alerts.mjs");
    expect(step?.env?.SECURITY_ALERTS_TOKEN).toBe("${{ secrets.SECURITY_ALERTS_TOKEN }}");
    expect(Object.values(workflow.jobs).every((job) => (job["timeout-minutes"] ?? 0) > 0)).toBe(true);
  });
});
