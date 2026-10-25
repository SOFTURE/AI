import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { StatCards, StatPills, StatsFold } from "../../src/notion/Stats.js";
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
    expect(html).toContain('<div data-slot="stats-fold-content" class="flex flex-col gap-3 pt-2 pb-1 pl-6"><p>figures</p></div>');
  });

  it("adds the caller's class to the fold", () => {
    expect(renderToStaticMarkup(<StatsFold title="Summary" className="mt-4">x</StatsFold>)).toContain(
      'class="group/stats-fold mt-4"',
    );
  });
});

describe("StatCards", () => {
  const cards = [{ key: "paid", label: "Paid", value: "1 200 PLN" }] as const;

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
