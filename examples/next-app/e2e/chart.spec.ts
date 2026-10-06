import { expect, test } from "@playwright/test";
import { chartsMessages } from "@softure-ai/charts";
import { formatMessage } from "@softure-ai/core";
import { DEFAULT_THEME } from "@softure-ai/ui";
import { en } from "../messages/en.ts";

const copy = en.chart;
const DATES = ["Jan 1, 2026", "Feb 1, 2026", "Mar 1, 2026", "Apr 1, 2026", "May 1, 2026", "Jun 1, 2026", "Jul 1, 2026"];

/** `#rrggbb` as the `rgb(r, g, b)` that getComputedStyle reports. */
function toComputedRgb(hex: string): string {
  const [red, green, blue] = [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16));
  return `rgb(${String(red)}, ${String(green)}, ${String(blue)})`;
}

test.use({ colorScheme: "light" });

test("the chart's data is a table named by the chart's title, one row per month in the app's zone", async ({ page }) => {
  await page.goto("/chart");
  const table = page.getByRole("table", { name: copy.chartTitle });
  await expect(table.getByRole("rowheader")).toHaveText(DATES);
  await expect(table.getByRole("columnheader")).toHaveText([chartsMessages.en.table.date, copy.savings, copy.spending]);
  await expect(table.getByRole("row").last()).toContainText("12,000");
});

test("the arrow keys walk the points and the readout announces each one", async ({ page }) => {
  await page.goto("/chart");
  const cursor = page.getByRole("group", { name: formatMessage(chartsMessages.en.cursor.label, { title: copy.chartTitle }) });
  const readout = cursor.getByRole("status");
  await cursor.focus();
  await expect(readout).toHaveText("");

  await page.keyboard.press("ArrowRight");
  await expect(readout).toContainText(DATES[0] ?? "");
  await expect(readout).toContainText("1,000");
  await page.keyboard.press("ArrowRight");
  await expect(readout).toContainText(DATES[1] ?? "");
  await page.keyboard.press("End");
  await expect(readout).toContainText(DATES[6] ?? "");
  await expect(readout).toContainText("12,000");
  await page.keyboard.press("Escape");
  await expect(readout).toHaveText("");
});

test("a pointer snaps to the nearest month", async ({ page }) => {
  await page.goto("/chart");
  const plot = page.locator(".sft-chart-plot");
  const readout = page.locator(".sft-chart-readout");
  const box = await plot.boundingBox();
  if (box === null) throw new Error("The chart's plot has no box");

  await page.mouse.move(box.x + box.width - 2, box.y + box.height / 2);
  await expect(readout).toContainText(DATES[6] ?? "");
  await page.mouse.move(box.x + 2, box.y + box.height / 2);
  await expect(readout).toContainText(DATES[0] ?? "");
});

test("the chart is drawn in the chart tokens, with the flag over its month", async ({ page }) => {
  await page.goto("/chart");
  await expect(page.locator(".sft-chart-line.sft-chart-series-1")).toHaveCSS("stroke", toComputedRgb(DEFAULT_THEME.light["chart-series-1"]));
  await expect(page.locator(".sft-chart-flag")).toHaveText(copy.raise);
  await expect(page.locator(".sft-chart-legend")).toContainText(copy.spending);
});
