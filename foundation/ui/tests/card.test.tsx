import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Card, EmptyState, FormError, Stat, uiMessages } from "../src/index.js";

describe("Card", () => {
  it("renders the title as a plain h2 inside a header", () => {
    const html = renderToStaticMarkup(
      <Card title="Savings">
        <p>body</p>
      </Card>,
    );
    expect(html).toMatch(/^<section class="sft:[^"]*"><header class="[^"]*"><div><div class="[^"]*"><h2 class="[^"]*">Savings<\/h2><\/div><\/div><\/header><p>body<\/p><\/section>$/);
  });

  it("renders no header without a title", () => {
    expect(renderToStaticMarkup(<Card>x</Card>)).not.toContain("<header");
  });

  it("puts the hint next to the heading, named after the title in the chosen locale", () => {
    const html = renderToStaticMarkup(
      <Card title="Savings" hint="How it is counted" hintId="savings-hint" locale="pl">
        x
      </Card>,
    );
    expect(html).toContain("<h2");
    expect(html).toMatch(/Savings<\/h2><span/);
    expect(html).toContain(`aria-label="${uiMessages.pl.card.hintLabel.replace("{title}", "Savings")}"`);
    expect(html).toContain('aria-describedby="savings-hint"');
    expect(html).toContain('id="savings-hint" role="tooltip"');
  });

  it("takes a partial message override", () => {
    const html = renderToStaticMarkup(
      <Card title="Savings" hint="h" messages={{ hintLabel: "Explain {title}" }}>
        x
      </Card>,
    );
    expect(html).toContain('aria-label="Explain Savings"');
  });

  it("renders no hint trigger on a card without an explanation", () => {
    expect(renderToStaticMarkup(<Card title="Savings">x</Card>)).not.toContain('role="tooltip"');
  });

  it("renders the subtitle and the action in the header", () => {
    const html = renderToStaticMarkup(
      <Card title="Debts" subtitle="3 of 5" action={<button type="button">Add</button>}>
        x
      </Card>,
    );
    expect(html).toMatch(/>3 of 5<\/div><\/div><button type="button">Add<\/button><\/header>/);
  });

  it("differs between variants in frame and room, and takes an anchor id", () => {
    const rootOf = (variant: "boxed" | "flat" | "lead") =>
      renderToStaticMarkup(<Card id="c" variant={variant} />).match(/class="([^"]*)"/)?.[1] ?? "";
    expect(rootOf("boxed")).toContain("sft:p-5");
    expect(rootOf("lead")).toContain("sft:p-6");
    expect(rootOf("flat")).not.toContain("sft:rounded-card");
    expect(renderToStaticMarkup(<Card id="c" />)).toContain('id="c"');
  });

  it("supports slots and unstyled", () => {
    const html = renderToStaticMarkup(
      <Card title="T" unstyled classNames={{ root: "app-card", title: "app-title" }}>
        x
      </Card>,
    );
    expect(html).not.toContain("sft:");
    expect(html).toBe('<section class="app-card"><header><div><div><h2 class="app-title">T</h2></div></div></header>x</section>');
  });
});

describe("Stat", () => {
  it("renders label, value, secondary figure and note in order", () => {
    const html = renderToStaticMarkup(<Stat label="Net worth" value="1,000" secondary="900" hint="today" />);
    expect(html.replace(/ class="[^"]*"/g, "")).toBe(
      "<div><div>Net worth</div><div>1,000</div><div>900</div><div>today</div></div>",
    );
  });

  it("maps tones onto token colours", () => {
    expect(renderToStaticMarkup(<Stat label="a" value="1" tone="danger" />)).toContain("sft:text-danger");
    expect(renderToStaticMarkup(<Stat label="a" value="1" tone="success" />)).toContain("sft:text-success");
    expect(renderToStaticMarkup(<Stat label="a" value="1" />)).toContain("sft:text-foreground");
  });

  it("uses equal-width digits for the figures", () => {
    expect(renderToStaticMarkup(<Stat label="a" value="1" />)).toContain("sft:tabular-nums");
  });
});

describe("EmptyState", () => {
  it("renders a framed title and description, or a bare one", () => {
    expect(renderToStaticMarkup(<EmptyState title="No data">Add an account.</EmptyState>)).toMatch(
      /^<div class="[^"]*sft:border-dashed[^"]*"><p class="[^"]*">No data<\/p><p class="[^"]*">Add an account.<\/p><\/div>$/,
    );
    expect(renderToStaticMarkup(<EmptyState title="No data" isBare />)).not.toContain("border-dashed");
  });
});

describe("FormError", () => {
  it("renders an alert with the message", () => {
    expect(renderToStaticMarkup(<FormError message="Failed" />)).toMatch(/^<p role="alert" class="sft:[^"]*">Failed<\/p>$/);
  });

  it("renders nothing without a message, empty included", () => {
    expect(renderToStaticMarkup(<FormError />)).toBe("");
    expect(renderToStaticMarkup(<FormError message="" />)).toBe("");
  });
});
