import type { OriginReport } from "./origin-check.js";
import type { RouteReport, VerifyReport } from "./run-checks.js";
import type { TlsReport } from "./tls-check.js";

const COLUMNS = ["Result", "Status", "Route", "Detail"] as const;

function toRow(report: RouteReport): string[] {
  const failed = report.checks.filter((check) => !check.passed);
  const detail =
    failed.length === 0
      ? `${report.checks.length} ${report.checks.length === 1 ? "check" : "checks"} passed`
      : failed.map((check) => check.detail).join("; ");
  const route = report.method === "GET" ? report.path : `${report.method} ${report.path}`;
  return [report.passed ? "PASS" : "FAIL", report.status === null ? "-" : String(report.status), route, detail];
}

function toTlsRow(tls: TlsReport): string[] {
  return [tls.passed ? "PASS" : "FAIL", "-", "tls", tls.detail];
}

function toOriginRow(origin: OriginReport): string[] {
  return [origin.passed ? "PASS" : "FAIL", "-", "origin", origin.detail];
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
  const failed = routes.filter((route) => !route.passed).length;
  const certificate = tls === null ? "" : `; certificate ${tls.passed ? "passed" : "failed"}`;
  const direct = origin === null ? "" : `; origin ${origin.passed ? "passed" : "failed"}`;
  const summary = `verify: ${routes.length} routes at ${baseUrl}, ${routes.length - failed} passed, ${failed} failed${certificate}${direct}`;
  return [formatRow(COLUMNS, widths), ...rows.map((row) => formatRow(row, widths)), "", summary, ""].join("\n");
}
