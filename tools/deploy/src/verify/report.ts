import type { OriginRow, RouteReport, VerifyReport } from "./run-checks.js";
import type { Severity } from "./schema.js";
import type { TlsReport } from "./tls-check.js";

const COLUMNS = ["Result", "Status", "Route", "Detail"] as const;

/** PASS, or for a failed row FAIL, or WARN when its severity is warn. */
function getResult(passed: boolean, severity: Severity): string {
  if (passed) return "PASS";
  return severity === "warn" ? "WARN" : "FAIL";
}

/** A failed row that fails the run (severity fail). */
export function isFailure(row: { passed: boolean; severity: Severity }): boolean {
  return !row.passed && row.severity === "fail";
}

function toRow(report: RouteReport): string[] {
  const failed = report.checks.filter((check) => !check.passed);
  const detail =
    failed.length === 0
      ? `${report.checks.length} ${report.checks.length === 1 ? "check" : "checks"} passed`
      : failed.map((check) => check.detail).join("; ");
  const route = report.method === "GET" ? report.path : `${report.method} ${report.path}`;
  return [getResult(report.passed, report.severity), report.status === null ? "-" : String(report.status), route, detail];
}

function toTlsRow(tls: TlsReport): string[] {
  return [tls.passed ? "PASS" : "FAIL", "-", "tls", tls.detail];
}

function toOriginRow(origin: OriginRow): string[] {
  return [getResult(origin.passed, origin.severity), "-", "origin", origin.detail];
}

/** The last column is not padded, so long details do not leave trailing spaces. */
function formatRow(cells: readonly string[], widths: readonly number[]): string {
  return cells.map((cell, index) => (index === cells.length - 1 ? cell : cell.padEnd(widths[index] ?? 0))).join("  ");
}

/** The verify table, one row per route in config order, then the `tls` and `origin` rows, and a summary line. */
export function formatVerifyReport(report: VerifyReport, baseUrl: string): string {
  const { routes, tls, origin } = report;
  const rows = [
    ...routes.map(toRow),
    ...(tls === null ? [] : [toTlsRow(tls)]),
    ...(origin === null ? [] : [toOriginRow(origin)]),
  ];
  const widths = COLUMNS.map((title, index) => Math.max(title.length, ...rows.map((row) => row[index]?.length ?? 0)));
  const passed = routes.filter((route) => route.passed).length;
  const failed = routes.filter(isFailure).length;
  const warned = routes.length - passed - failed;
  const warnings = warned === 0 ? "" : `, ${warned} warned`;
  const certificate = tls === null ? "" : `; certificate ${tls.passed ? "passed" : "failed"}`;
  const direct = origin === null ? "" : `; origin ${{ PASS: "passed", FAIL: "failed", WARN: "warned" }[getResult(origin.passed, origin.severity)]}`;
  const summary = `verify: ${routes.length} routes at ${baseUrl}, ${passed} passed, ${failed} failed${warnings}${certificate}${direct}`;
  return [formatRow(COLUMNS, widths), ...rows.map((row) => formatRow(row, widths)), "", summary, ""].join("\n");
}
