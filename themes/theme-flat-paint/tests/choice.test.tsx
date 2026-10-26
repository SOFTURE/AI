import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CHECKBOX_LOOK, CHOICE_CARD_LOOK, CHOICE_ROW_LOOK, RADIO_LOOK, type ChoiceSlot } from "../src/index.js";

function renderChoice(look: Readonly<Record<ChoiceSlot, string>>, isControlFirst: boolean): string {
  const control = (
    <span className={look.control}>
      <span className={RADIO_LOOK.box}>
        <input type="radio" name="plan" value="yearly" defaultChecked className={RADIO_LOOK.input} />
        <span className={RADIO_LOOK.mark} aria-hidden="true">
          ✓
        </span>
      </span>
    </span>
  );
  const body = (
    <span className={look.body}>
      <span className={look.title}>Yearly</span>
      <span className={look.description}>Billed once a year</span>
    </span>
  );
  return renderToStaticMarkup(
    <label className={look.label}>
      {isControlFirst ? control : body}
      {isControlFirst ? body : control}
    </label>,
  );
}

function getClassAttributes(markup: string): string[] {
  return [...markup.matchAll(/class="([^"]*)"/g)].map((match) => match[1] ?? "");
}

describe("radio look", () => {
  it("draws the checked radio as a lime disc with an accent line and a black check that scales in", () => {
    expect(RADIO_LOOK).toEqual({
      box: "relative inline-flex size-5 shrink-0",
      input:
        "peer m-0 size-5 cursor-pointer appearance-none rounded-full border border-line-strong bg-surface-raised transition checked:border-accent checked:bg-accent-fill focus-visible:outline-none",
      mark: "pointer-events-none absolute inset-0 flex scale-0 items-center justify-center text-on-accent transition peer-checked:scale-100",
    });
  });

  it("uses the checkbox frame's idle and checked colours, so the two controls read as one family", () => {
    for (const className of ["border-line-strong", "bg-surface-raised", "checked:border-accent", "checked:bg-accent-fill"]) {
      const frameClass = className.replace("checked:", "peer-checked:");
      expect([className, CHECKBOX_LOOK.frame.split(" ").includes(frameClass)]).toEqual([className, true]);
    }
  });

  it("has one checked drawing: no thick-border ring variant", () => {
    expect(RADIO_LOOK.input).not.toMatch(/checked:border-\[/);
  });
});

describe("choice row look", () => {
  it("marks the checked row with a wash and the lime bar, and focus with an inset accent outline", () => {
    expect(CHOICE_ROW_LOOK).toEqual({
      label:
        "group flex cursor-pointer items-start gap-4 px-2 py-4 transition hover:bg-foreground/[0.03] has-checked:bg-foreground/[0.04] has-checked:shadow-selected-row has-focus-visible:outline-2 has-focus-visible:-outline-offset-2 has-focus-visible:outline-accent sm:px-4",
      control: "mt-0.5 flex shrink-0",
      body: "min-w-0 flex-1",
      title: "block text-foreground group-has-checked:font-bold",
      description: "mt-1 block text-xs leading-snug text-muted",
    });
  });

  it("puts each slot on its element in the documented markup", () => {
    expect(getClassAttributes(renderChoice(CHOICE_ROW_LOOK, true))).toEqual([
      CHOICE_ROW_LOOK.label,
      CHOICE_ROW_LOOK.control,
      RADIO_LOOK.box,
      RADIO_LOOK.input,
      RADIO_LOOK.mark,
      CHOICE_ROW_LOOK.body,
      CHOICE_ROW_LOOK.title,
      CHOICE_ROW_LOOK.description,
    ]);
  });
});

describe("choice card look", () => {
  it("marks the checked card with a doubled foreground line, and focus with an accent outline outside it", () => {
    expect(CHOICE_CARD_LOOK).toEqual({
      label:
        "group flex cursor-pointer items-start justify-between gap-3 rounded-nested border border-line-strong bg-surface p-4 transition hover:border-muted has-checked:border-foreground has-checked:ring-1 has-checked:ring-inset has-checked:ring-foreground has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent",
      control: "flex shrink-0",
      body: "min-w-0 flex-1",
      title: "block text-foreground group-has-checked:font-bold",
      description: "mt-1 block text-xs leading-snug text-muted",
    });
  });

  it("draws focus without a ring, so it never fights the checked ring", () => {
    expect(CHOICE_CARD_LOOK.label.split(" ").filter((className) => className.startsWith("has-focus-visible:ring"))).toEqual([]);
  });

  it("puts each slot on its element with the radio at the end", () => {
    expect(getClassAttributes(renderChoice(CHOICE_CARD_LOOK, false))).toEqual([
      CHOICE_CARD_LOOK.label,
      CHOICE_CARD_LOOK.body,
      CHOICE_CARD_LOOK.title,
      CHOICE_CARD_LOOK.description,
      CHOICE_CARD_LOOK.control,
      RADIO_LOOK.box,
      RADIO_LOOK.input,
      RADIO_LOOK.mark,
    ]);
  });
});
