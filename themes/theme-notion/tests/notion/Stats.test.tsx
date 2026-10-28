import { Wallet } from "lucide-react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { StatCards, StatPills, StatsFold, type StatCard } from "../../src/notion/Stats.js";
import { readTextNodes } from "../support.js";

describe("StatsFold", () => {
  it("is closed by default and puts the heading in the summary as an h2", () => {
    const html = renderToStaticMarkup(
      <StatsFold title="Summary">
        <p>figures</p>
      </StatsFold>,
    );

    expect(html).toMatch(/^<details data-slot="stats-fold" class="group\/stats-fold">/);
    expect(html).not.toContain(" open");
    expect(html).toContain('<summary data-slot="stats-fold-summary"');
    expect(html).toContain('<h2 class="text-ui-medium">Summary</h2>');
    expect(html).toContain("group-open/stats-fold:rotate-90");
  });

  it("spans the heading row's full width by default, with no horizontal padding on the content (#831)", () => {
    const html = renderToStaticMarkup(
      <StatsFold title="Summary">
        <p>figures</p>
      </StatsFold>,
    );

    expect(html).toContain(
      '<div data-slot="stats-fold-content" data-inset="false" class="flex flex-col gap-3 pt-2 pb-1"><p>figures</p></div>',
    );
  });

  it("indents the content to the title after the chevron with isInset (#831)", () => {
    const html = renderToStaticMarkup(
      <StatsFold title="Summary" isInset>
        <p>figures</p>
      </StatsFold>,
    );

    expect(html).toContain(
      '<div data-slot="stats-fold-content" data-inset="true" class="flex flex-col gap-3 pt-2 pb-1 pl-6"><p>figures</p></div>',
    );
  });

  it("adds the caller's class to the fold", () => {
    expect(renderToStaticMarkup(<StatsFold title="Summary" className="mt-4">x</StatsFold>)).toContain(
      'class="group/stats-fold mt-4"',
    );
  });
});

describe("StatCards", () => {
  const cards = [{ key: "paid", label: "Paid", value: "1 200 PLN" }] as const;

  it("draws a decorative icon before the label in the label's row when given one (#813)", () => {
    const html = renderToStaticMarkup(
      <StatCards label="Totals" cards={[{ key: "paid", label: "Paid", value: "1 200 PLN", icon: Wallet }]} />,
    );

    expect(html).toMatch(
      /<div class="flex items-center gap-1\.5 text-section-label text-muted-foreground"><svg [^>]*aria-hidden="true"[^>]*>.*?<\/svg>Paid<\/div>/,
    );
    expect(html).toMatch(/<svg [^>]*stroke-width="1\.75"[^>]*class="lucide lucide-wallet size-4 shrink-0"/);
    expect(readTextNodes(html)).toEqual(["Paid", "1 200 PLN"]);
  });

  it("keeps the label's markup without an icon", () => {
    const html = renderToStaticMarkup(<StatCards label="Totals" cards={cards} />);

    expect(html).toContain('<div class="text-section-label text-muted-foreground">Paid</div>');
    expect(html).not.toContain("<svg");
  });

  it("draws the narrow grid by default", () => {
    const html = renderToStaticMarkup(<StatCards label="Totals" cards={cards} />);

    expect(html).toContain(
      '<ul aria-label="Totals" data-slot="stat-cards" data-layout="grid" class="grid gap-2 grid-cols-[repeat(auto-fill,minmax(min(10rem,100%),1fr))]">',
    );
  });

  it("stretches the cards across the column when full width", () => {
    const html = renderToStaticMarkup(<StatCards label="Totals" cards={cards} isFullWidth />);

    expect(html).toContain(
      'data-layout="full" class="grid gap-2 grid-cols-[repeat(auto-fit,minmax(min(14rem,100%),1fr))]"',
    );
  });

  it("puts every card in one row from sm up, over the full width flag", () => {
    const html = renderToStaticMarkup(<StatCards label="Totals" cards={cards} isFullWidth isOneRow />);

    expect(html).toContain(
      'data-layout="row" class="grid gap-2 grid-cols-[repeat(auto-fit,minmax(min(14rem,100%),1fr))] sm:auto-cols-fr sm:grid-flow-col sm:grid-cols-none"',
    );
  });

  it("leaves out the hint and the aside it is not given and writes the figure in the text colour", () => {
    const html = renderToStaticMarkup(<StatCards label="Totals" cards={cards} />);

    expect(html).toContain('<li data-stat="paid"');
    expect(html).toContain(
      '<div data-tone="default" class="mt-1 text-heading-3 whitespace-nowrap tabular-nums text-foreground">1 200 PLN</div>',
    );
    expect(html).not.toContain("text-small");
    expect(html).not.toContain("stat-card-aside");
    expect(readTextNodes(html)).toEqual(["Paid", "1 200 PLN"]);
  });

  it("renders the hint, the figure in its tone and the aside as a tag in its tone", () => {
    const html = renderToStaticMarkup(
      <StatCards
        label="Totals"
        cards={[
          { key: "owed", label: "Owed", value: "300 PLN", tone: "danger", hint: "2 invoices", aside: { text: "+5%", tone: "success" } },
        ]}
      />,
    );

    expect(html).toContain('data-tone="danger" class="mt-1 text-heading-3 whitespace-nowrap tabular-nums text-red"');
    expect(html).toContain('<div class="mt-1 text-small text-muted-foreground">2 invoices</div>');
    expect(html).toMatch(/<span data-slot="stat-card-aside" data-variant="tag" class="[^"]*bg-green-tag[^"]*" data-tone="success">\+5%<\/span>/);
  });

  it("draws an aside without a tone as the default tag", () => {
    const html = renderToStaticMarkup(
      <StatCards label="Totals" cards={[{ key: "n", label: "Count", value: "4", aside: { text: "new" } }]} />,
    );

    expect(html).toMatch(/data-slot="stat-card-aside" data-variant="tag" class="[^"]*bg-default-tag[^"]*" data-tone="default"/);
  });
});

describe("StatCards progress", () => {
  function renderCard(card: Partial<StatCard>): string {
    return renderToStaticMarkup(<StatCards label="Budgets" cards={[{ key: "hours", label: "Hours", value: "21.5 / 23.4 h", ...card }]} />);
  }

  function readProgressBar(html: string): string {
    const match = /<div [^>]*role="progressbar"[^>]*>/.exec(html);
    if (match === null) throw new Error(`No progress bar in ${html}`);
    return match[0];
  }

  it("draws no bar and keeps the left column unchanged when not given a progress", () => {
    const html = renderCard({});

    expect(html).not.toContain("progressbar");
    expect(html).toContain('<li data-stat="hours" class="flex min-w-0 items-start justify-between gap-2 rounded-lg bg-card p-3 text-card-foreground shadow-card"><div class="min-w-0">');
  });

  it("draws a 6 px bar under the figure, above the hint, named after the label", () => {
    const html = renderCard({ progress: 92, hint: "this month" });
    const bar = readProgressBar(html);

    expect(bar).toContain('aria-valuenow="92"');
    expect(bar).toContain('aria-label="Hours"');
    expect(bar).toContain('data-slot="stat-card-progress"');
    expect(bar).toContain('class="relative h-1.5 w-full overflow-hidden rounded-full bg-primary/20 mt-2"');
    expect(html).toContain('<div class="min-w-0 flex-1">');
    expect(html.indexOf("21.5 / 23.4 h")).toBeLessThan(html.indexOf('role="progressbar"'));
    expect(html.indexOf('role="progressbar"')).toBeLessThan(html.indexOf("this month"));
    expect(readTextNodes(html)).toEqual(["Hours", "21.5 / 23.4 h", "this month"]);
  });

  it("takes the accessible name from progressLabel when given", () => {
    expect(readProgressBar(renderCard({ progress: 50, progressLabel: "Hours used of the budget" }))).toContain(
      'aria-label="Hours used of the budget"',
    );
  });

  it("fills the bar in primary without a tone and in the tone's colour with one", () => {
    expect(renderCard({ progress: 50 })).toContain('data-slot="progress-indicator" class="h-full w-full flex-1 bg-primary transition-all dark:bg-link"');
    expect(renderCard({ progress: 50, tone: "warning" })).toContain(
      'data-slot="progress-indicator" class="h-full w-full flex-1 transition-all bg-orange"',
    );
    expect(renderCard({ progress: 50, tone: "default" })).toContain(
      'data-slot="progress-indicator" class="h-full w-full flex-1 transition-all bg-gray"',
    );
  });

  it.each([
    { progress: -5, expected: 0 },
    { progress: 0, expected: 0 },
    { progress: 100, expected: 100 },
    { progress: 140, expected: 100 },
    { progress: Number.NaN, expected: 0 },
  ])("clamps $progress to $expected", ({ progress, expected }) => {
    const html = renderCard({ progress });

    expect(readProgressBar(html)).toContain(`aria-valuenow="${String(expected)}"`);
    expect(html).toContain(`style="transform:translateX(-${String(100 - expected)}%)"`);
  });
});

describe("StatPills", () => {
  it("keeps the pills in the given order, each as label and value in its tone", () => {
    const html = renderToStaticMarkup(
      <StatPills
        label="Counts"
        pills={[
          { key: "done", label: "Done", value: "3", tone: "success" },
          { key: "open", label: "Open", value: "2" },
          { key: "late", label: "Late", value: "1", tone: "danger" },
        ]}
      />,
    );

    expect(html).toContain('<ul aria-label="Counts" data-slot="stat-pills" class="flex flex-wrap gap-1.5 sm:flex-nowrap sm:overflow-x-auto">');
    expect([...html.matchAll(/data-stat="([^"]+)" data-tone="([^"]+)"/g)].map((match) => `${match[1]}:${match[2]}`)).toEqual([
      "done:success",
      "open:default",
      "late:danger",
    ]);
    expect(html).toContain("bg-green-tag");
    expect(html).toContain("bg-default-tag");
    expect(html).toContain("bg-red-tag");
    expect(html).toContain('Done <strong class="font-medium tabular-nums">3</strong>');
  });

  it("renders an empty list when given no pills", () => {
    expect(renderToStaticMarkup(<StatPills label="Counts" pills={[]} />)).toBe(
      '<ul aria-label="Counts" data-slot="stat-pills" class="flex flex-wrap gap-1.5 sm:flex-nowrap sm:overflow-x-auto"></ul>',
    );
  });
});
