// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Checkbox, SegmentedControl, Switch, SwitchControl, uiMessages } from "../src/index.js";

afterEach(cleanup);

describe("SwitchControl", () => {
  it("is a native checkbox with the switch role and no aria-checked", () => {
    const html = renderToStaticMarkup(<SwitchControl name="notify" defaultChecked />);
    const input = html.match(/<input [^>]*>/)?.[0] ?? "";
    for (const attribute of ['type="checkbox"', 'role="switch"', 'name="notify"', 'checked=""']) expect(input).toContain(attribute);
    expect(html).not.toContain("aria-checked");
  });

  it("draws the state from :checked through peer classes, with a hittable input over the drawing", () => {
    const html = renderToStaticMarkup(<SwitchControl />);
    expect(html).toMatch(/<input [^>]*class="sft:peer sft:absolute sft:inset-0 sft:z-10[^"]*sft:opacity-0/);
    expect(html).not.toContain("sr-only");
    expect(html).toContain("sft:peer-checked:bg-accent-fill");
    expect(html).toContain("sft:peer-checked:translate-x-5");
  });

  it("passes the disclosure attributes of the panel it reveals", () => {
    const html = renderToStaticMarkup(<SwitchControl aria-expanded={false} aria-controls="panel" aria-label="Details" />);
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('aria-controls="panel"');
    expect(html).toContain('aria-label="Details"');
  });

  it("is disabled natively, without aria-disabled", () => {
    const html = renderToStaticMarkup(<SwitchControl disabled />);
    expect(html).toContain('disabled=""');
    expect(html).not.toContain("aria-disabled");
  });

  it("reports the new state to onChange", () => {
    const onChange = vi.fn();
    render(<SwitchControl aria-label="Notify" onChange={onChange} />);
    fireEvent.click(screen.getByRole("switch", { name: "Notify" }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith(true);
  });
});

describe("Switch", () => {
  it("labels the input with <label for> and puts the hint next to the label, not in it", () => {
    const html = renderToStaticMarkup(<Switch id="s" name="notify" label="Notify me" hint="We send one mail" />);
    expect(html).toMatch(/<label for="s" class="[^"]*">Notify me<\/label><span/);
    expect(html).toContain(`aria-label="${uiMessages.en.field.hintLabel.replace("{label}", "Notify me")}"`);
  });

  it("ties the description to the input", () => {
    const html = renderToStaticMarkup(<Switch id="s" name="n" label="L" description="Sent weekly" />);
    expect(html).toContain('aria-describedby="s-description"');
    expect(html).toMatch(/<span id="s-description" class="[^"]*">Sent weekly<\/span>/);
  });

  it("keeps both state lines in the markup, switched by :checked", () => {
    const html = renderToStaticMarkup(<Switch name="n" label="L" stateText={{ on: "On", off: "Off" }} />);
    expect(html).toMatch(/group-has-checked\/switch:visible">On</);
    expect(html).toMatch(/group-has-checked\/switch:invisible">Off</);
  });

  it("generates an id when none is given, and the label still names the switch", () => {
    render(<Switch name="n" label="Dark mode" />);
    expect(screen.getByRole("switch", { name: "Dark mode" })).toBeDefined();
  });

  it("toggles when the label is clicked", () => {
    render(<Switch name="n" label="Dark mode" />);
    const input = screen.getByRole<HTMLInputElement>("switch", { name: "Dark mode" });
    fireEvent.click(screen.getByText("Dark mode"));
    expect(input.checked).toBe(true);
  });

  it("sends 'on' under its name when checked, like a native checkbox", () => {
    render(
      <form data-testid="f">
        <Switch name="canWrite" label="Write" defaultChecked />
      </form>,
    );
    const form = screen.getByTestId<HTMLFormElement>("f");
    expect(new FormData(form).get("canWrite")).toBe("on");
  });
});

describe("Checkbox", () => {
  it("is a native checkbox without the switch role, labelled by its statement", () => {
    const html = renderToStaticMarkup(
      <Checkbox id="c" name="consent" label={<>I accept the <a href="/terms">terms</a></>} required />,
    );
    const input = html.match(/<input [^>]*>/)?.[0] ?? "";
    for (const attribute of ['id="c"', 'type="checkbox"', 'name="consent"', 'required=""']) expect(input).toContain(attribute);
    expect(html).not.toContain('role="switch"');
    expect(html).toContain('<label for="c" class="sft:cursor-pointer sft:text-sm sft:text-foreground">I accept the <a href="/terms">terms</a></label>');
  });

  it("with an error: aria-invalid, the message under it, error first in aria-describedby", () => {
    const html = renderToStaticMarkup(<Checkbox id="c" name="consent" label="L" error="Required" description="Why" />);
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('aria-describedby="c-error c-description"');
    expect(html).toMatch(/<p id="c-error" class="[^"]*">Required<\/p>/);
  });

  it("without an error: no aria-invalid and no empty paragraph", () => {
    for (const error of [undefined, ""]) {
      const html = renderToStaticMarkup(<Checkbox id="c" name="consent" label="L" error={error} />);
      // `aria-invalid="`, not the bare word: class names carry `peer-aria-invalid:`.
      expect(html).not.toContain('aria-invalid="');
      expect(html).not.toMatch(/<p[ >]/);
    }
  });

  it("has a 24 px target: the input fills the size-6 box", () => {
    const html = renderToStaticMarkup(<Checkbox name="c" label="L" />);
    expect(html).toMatch(/<span class="[^"]*sft:size-6[^"]*"><input [^>]*sft:size-full/);
  });
});

describe("SegmentedControl", () => {
  const OPTIONS = [
    { value: "month", label: "Month" },
    { value: "year", label: "Year" },
  ] as const;

  it("is a fieldset of native radios with one checked", () => {
    const html = renderToStaticMarkup(
      <SegmentedControl options={OPTIONS} value="year" onChange={() => undefined} legend="Period" name="period" />,
    );
    expect(html).toMatch(/^<fieldset class="[^"]*"><legend class="[^"]*">Period<\/legend>/);
    expect(html.match(/type="radio"/g)).toHaveLength(2);
    const checked = [...html.matchAll(/<input [^>]*>/g)].map(([input]) => input).filter((input) => input.includes('checked=""'));
    expect(checked).toHaveLength(1);
    expect(checked[0]).toContain('value="year"');
    expect(checked[0]).toContain('name="period"');
  });

  it("hides the legend visually when asked, keeping it for assistive technology", () => {
    const html = renderToStaticMarkup(
      <SegmentedControl options={OPTIONS} value="year" onChange={() => undefined} legend="Period" isLegendHidden />,
    );
    expect(html).toContain('<legend class="sft:sr-only">Period</legend>');
  });

  it("reports the picked value", () => {
    const onChange = vi.fn();
    render(<SegmentedControl options={OPTIONS} value="month" onChange={onChange} legend="Period" />);
    fireEvent.click(screen.getByRole("radio", { name: "Year" }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith("year");
  });
});
