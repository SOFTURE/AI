import type { RouteReport } from "./run-checks.js";

const COLUMNS = ["Result", "Status", "Route", "Detail"] as const;

function toRow(report: RouteReport): string[] {
  const failed = report.checks.filter((check) => !check.passed);
  const detail =
    failed.length === 0
      ? `${report.checks.length} ${report.checks.length === 1 ? "check" : "checks"} passed`
      : failed.map((check) => check.detail).join("; ");
  return [report.passed ? "PASS" : "FAIL", report.status === null ? "-" : String(report.status), report.path, detail];
}

/** The last column is not padded, so long details do not leave trailing spaces. */
function formatRow(cells: readonly string[], widths: readonly number[]): string {
  return cells.map((cell, index) => (index === cells.length - 1 ? cell : cell.padEnd(widths[index] ?? 0))).join("  ");
}

/** The verify table, one row per route in config order, and a summary line. */
export function formatVerifyReport(reports: readonly RouteReport[], baseUrl: string): string {
  const rows = reports.map(toRow);
  const widths = COLUMNS.map((title, index) => Math.max(title.length, ...rows.map((row) => row[index]?.length ?? 0)));
  const failed = reports.filter((report) => !report.passed).length;
  const summary = `verify: ${reports.length} routes at ${baseUrl}, ${reports.length - failed} passed, ${failed} failed`;
  return [formatRow(COLUMNS, widths), ...rows.map((row) => formatRow(row, widths)), "", summary, ""].join("\n");
}
