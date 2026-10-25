import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import * as theme from "../../src/index.js";
import { Steps, type StepItem } from "../../src/notion/Steps.js";

const STEPS: readonly StepItem[] = [
  { key: "period", title: "Period", state: "done" },
  { key: "document", title: "Document", state: "current", note: "Two files" },
  { key: "draft", title: "E-mail draft", state: "failed", aside: <em>mail</em> },
  { key: "invoice", title: "Final invoice" },
];

const NUMBER_BASE = "mt-px flex size-5 shrink-0 items-center justify-center text-small font-medium tabular-nums";

function readNumbers(html: string): string[] {
  return [...html.matchAll(/data-slot="step-number"[^>]*>(\d+)</g)].map((match) => match[1] ?? "");
}

describe("Steps", () => {
  it("renders one step as a labelled ordered list of cards by default", () => {
    expect(renderToStaticMarkup(<Steps label="Stages" steps={[{ key: "only", title: "Only" }]} />)).toBe(
      '<ol aria-label="Stages" data-slot="steps" data-layout="row" class="grid grid-cols-[repeat(auto-fill,minmax(min(12rem,100%),1fr))] gap-2">' +
        '<li data-step="only" data-state="todo" class="flex min-w-0 items-start gap-2 rounded-lg bg-card p-3 text-card-foreground shadow-card data-[state=current]:bg-blue-bg">' +
        `<span aria-hidden="true" data-slot="step-number" class="${NUMBER_BASE} rounded-full bg-muted text-muted-foreground">1</span>` +
        '<div class="min-w-0 flex-1"><div class="text-sm font-medium">Only<span class="sr-only">, To do</span></div></div></li></ol>',
    );
  });

  it("numbers the steps in the given order", () => {
    const html = renderToStaticMarkup(<Steps label="Stages" steps={STEPS} />);

    expect(readNumbers(html)).toEqual(["1", "2", "3", "4"]);
    expect([...html.matchAll(/data-step="([^"]+)"/g)].map((match) => match[1])).toEqual(["period", "document", "draft", "invoice"]);
  });

  it("marks only the current step with aria-current", () => {
    const html = renderToStaticMarkup(<Steps label="Stages" steps={STEPS} />);

    expect(html.match(/aria-current=/g)).toHaveLength(1);
    expect(html).toContain('data-step="document" data-state="current" aria-current="step"');
  });

  it("sets no aria-current when no step is current", () => {
    const html = renderToStaticMarkup(<Steps label="Stages" steps={[{ key: "a", title: "A", state: "done" }]} />);

    expect(html).not.toContain("aria-current");
  });

  it("colours each number by its state and defaults to todo", () => {
    const html = renderToStaticMarkup(<Steps label="Stages" steps={STEPS} />);

    expect([...html.matchAll(/data-state="([a-z]+)"/g)].map((match) => match[1])).toEqual(["done", "current", "failed", "todo"]);
    expect(html).toContain(`class="${NUMBER_BASE} rounded-full bg-green-tag text-green-tag-foreground">1<`);
    expect(html).toContain(`class="${NUMBER_BASE} rounded-full bg-primary text-primary-foreground">2<`);
    expect(html).toContain(`class="${NUMBER_BASE} rounded-full bg-red-tag text-red-tag-foreground">3<`);
    expect(html).toContain(`class="${NUMBER_BASE} rounded-full bg-muted text-muted-foreground">4<`);
  });

  it("renders the list layout as compact rows with square badges", () => {
    const html = renderToStaticMarkup(<Steps label="Stages" steps={STEPS} layout="list" />);

    expect(html).toContain('data-layout="list" class="flex flex-col"');
    expect(html.match(/class="flex min-w-0 items-start gap-2 rounded-md px-2 py-1\.5 transition-colors duration-120 hover:bg-accent"/g)).toHaveLength(4);
    expect(html.match(/ rounded-sm /g)).toHaveLength(4);
    expect(html).not.toContain("rounded-full");
    expect(html).not.toContain("shadow-card");
  });

  it("draws the note and the aside only when they are given", () => {
    const html = renderToStaticMarkup(<Steps label="Stages" steps={STEPS} />);

    expect(html.match(/data-slot="step-note"/g)).toHaveLength(1);
    expect(html).toContain('<div data-slot="step-note" class="mt-0.5 text-small text-muted-foreground">Two files</div>');
    expect(html.match(/data-slot="step-aside"/g)).toHaveLength(1);
    expect(html).toContain('<div data-slot="step-aside" class="shrink-0"><em>mail</em></div>');
  });

  it("names each state in words, replaceable by the app", () => {
    const html = renderToStaticMarkup(<Steps label="Stages" steps={STEPS} />);
    const own = renderToStaticMarkup(<Steps label="Stages" steps={STEPS} stateLabels={{ failed: "Error" }} />);

    expect([...html.matchAll(/<span class="sr-only">, ([^<]+)<\/span>/g)].map((match) => match[1])).toEqual([
      "Done",
      "Current",
      "Failed",
      "To do",
    ]);
    expect(own).toContain('E-mail draft<span class="sr-only">, Error</span>');
    expect(own).toContain('Period<span class="sr-only">, Done</span>');
  });

  it("returns an empty list for no steps", () => {
    expect(renderToStaticMarkup(<Steps label="Stages" steps={[]} layout="list" />)).toBe(
      '<ol aria-label="Stages" data-slot="steps" data-layout="list" class="flex flex-col"></ol>',
    );
  });

  it("is exported from the package root", () => {
    expect(theme.Steps).toBe(Steps);
  });
});
