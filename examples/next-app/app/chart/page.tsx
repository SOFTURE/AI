// A public page with one line chart of @softure-ai/charts: fixed monthly data, so the e2e reads exact
// values. Dates are midnights in the app's zone (Europe/Warsaw: UTC+1, UTC+2 from March 29).
import { LineChart, type TimePoint } from "@softure-ai/charts";
import { Card } from "@softure-ai/ui";
import { getMessages } from "../../messages/index.ts";
import config from "../../softure.config.ts";

const MONTHS = [
  "2025-12-31T23:00:00Z",
  "2026-01-31T23:00:00Z",
  "2026-02-28T23:00:00Z",
  "2026-03-31T22:00:00Z",
  "2026-04-30T22:00:00Z",
  "2026-05-31T22:00:00Z",
  "2026-06-30T22:00:00Z",
].map((iso) => new Date(iso));

const SAVINGS = [1000, 2500, 4000, 6000, 7500, 9500, 12000];
const SPENDING = [800, 900, 1100, 1000, 1200, 1300, 1250];

function toPoints(values: readonly number[]): TimePoint[] {
  return MONTHS.map((x, index) => ({ x, y: values[index] ?? 0 }));
}

export default function ChartPage() {
  const messages = getMessages(config.locale);
  const money = new Intl.NumberFormat(config.locale, { style: "currency", currency: "PLN", maximumFractionDigits: 0 });
  const raiseDate = MONTHS[3] ?? new Date(0);
  return (
    <main className="page">
      <Card title={messages.chart.title} subtitle={messages.chart.lead}>
        <LineChart
          title={messages.chart.chartTitle}
          series={[
            { key: "savings", label: messages.chart.savings, points: toPoints(SAVINGS) },
            { key: "spending", label: messages.chart.spending, points: toPoints(SPENDING), dashed: true },
          ]}
          flags={[{ key: "raise", x: raiseDate, label: messages.chart.raise }]}
          locale={config.locale}
          timeZone={config.timezone}
          formatValue={(value) => money.format(value)}
        />
      </Card>
    </main>
  );
}
