import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import {
  CheckboxField,
  Field,
  FieldGroup,
  getCheckedAfterSubmit,
  INPUT_CLASS,
  MoneyField,
  NUMBER_INPUT_CLASS,
  PasswordField,
  SelectField,
  TextField,
  uiMessages,
} from "../src/index.js";
import { type FormReplay, FormReplayProvider } from "../src/ui/form-context.js";

function getInput(html: string): string {
  return html.match(/<input [^>]*>/)?.[0] ?? "";
}

function withReplay(replay: Partial<FormReplay>, children: ReactNode) {
  return (
    <FormReplayProvider replay={{ values: {}, fieldErrors: {}, submitCount: 1, ...replay }}>{children}</FormReplayProvider>
  );
}

describe("Field", () => {
  it("labels the control with <label for> and keeps the tooltip hint out of the label", () => {
    const html = renderToStaticMarkup(
      <Field label="Rate" fieldId="rate" hint="Yearly" hintAs="tooltip" hintId="rate-hint">
        <input id="rate" />
      </Field>,
    );
    expect(html).toMatch(/<label for="rate" class="[^"]*">Rate<\/label><span/);
    expect(html).toContain(`aria-label="${uiMessages.en.field.hintLabel.replace("{label}", "Rate")}"`);
    expect(html).toContain('id="rate-hint" role="tooltip"');
  });

  it("puts the error between the control and the block hint", () => {
    const html = renderToStaticMarkup(
      <Field label="Rate" fieldId="rate" hint="Yearly" hintId="h" error="Too high" errorId="e">
        <input id="rate" />
      </Field>,
    );
    expect(html).toMatch(/<input id="rate"\/><p id="e" class="[^"]*">Too high<\/p><span id="h" class="[^"]*">Yearly<\/span>/);
    expect(html).not.toContain('role="alert"');
  });

  it("renders no paragraph for an empty error", () => {
    expect(renderToStaticMarkup(<Field label="L" error="">x</Field>)).not.toMatch(/<p[ >]/);
  });
});

describe("FieldGroup", () => {
  it("renders a section with an h3 title and a decorative rule", () => {
    expect(renderToStaticMarkup(<FieldGroup title="Taxes">x</FieldGroup>)).toMatch(
      /^<section class="[^"]*"><div class="[^"]*"><h3 class="[^"]*">Taxes<\/h3><span aria-hidden="true" class="[^"]*"><\/span><\/div>x<\/section>$/,
    );
  });
});

describe("TextField", () => {
  it("uses equal-width digits only for numeric input", () => {
    expect(getInput(renderToStaticMarkup(<TextField id="a" name="a" label="A" />))).toContain(`class="${INPUT_CLASS}"`);
    expect(getInput(renderToStaticMarkup(<TextField id="a" name="a" label="A" inputMode="decimal" />))).toContain(
      `class="${NUMBER_INPUT_CLASS}"`,
    );
  });

  it("points aria-describedby at a block hint but not at a tooltip hint", () => {
    expect(getInput(renderToStaticMarkup(<TextField id="a" name="a" label="A" hint="h" />))).toContain('aria-describedby="a-hint"');
    expect(getInput(renderToStaticMarkup(<TextField id="a" name="a" label="A" hint="h" hintAs="tooltip" />))).not.toContain(
      "aria-describedby",
    );
  });

  it("with an error: aria-invalid, the message under the field, error first in aria-describedby", () => {
    const html = renderToStaticMarkup(<TextField id="a" name="a" label="A" hint="h" error="Required" />);
    const input = getInput(html);
    expect(input).toContain('aria-invalid="true"');
    expect(input).toContain('aria-describedby="a-error a-hint"');
    expect(html).toMatch(/<p id="a-error" class="[^"]*">Required<\/p>/);
  });

  it("treats an empty error as no error", () => {
    const html = renderToStaticMarkup(<TextField id="a" name="a" label="A" error="" />);
    expect(html).not.toContain('aria-invalid="');
    expect(html).not.toMatch(/<p[ >]/);
  });

  it("draws a unit suffix inside the field and makes room for it", () => {
    const html = renderToStaticMarkup(<TextField id="a" name="a" label="A" suffix="kg" />);
    expect(getInput(html)).toContain("sft:pr-14");
    expect(html).toMatch(/<span aria-hidden="true" class="[^"]*">kg<\/span>/);
  });

  it("replays the submitted value and the field error of a rejected submit", () => {
    const html = renderToStaticMarkup(
      withReplay({ values: { city: "Lodz" }, fieldErrors: { city: "Unknown city" } }, <TextField id="c" name="city" label="City" defaultValue="Warsaw" />),
    );
    expect(getInput(html)).toContain('value="Lodz"');
    expect(html).toContain(">Unknown city</p>");
  });

  it("lets an explicit error win over the replayed one", () => {
    const html = renderToStaticMarkup(
      withReplay({ fieldErrors: { city: "Replayed" } }, <TextField id="c" name="city" label="City" error="Explicit" />),
    );
    expect(html).toContain(">Explicit</p>");
    expect(html).not.toContain("Replayed");
  });

  it("generates distinct ids for fields that share a name", () => {
    const html = renderToStaticMarkup(
      <>
        <TextField name="amount" label="A" />
        <TextField name="amount" label="B" />
      </>,
    );
    const ids = [...html.matchAll(/<input id="([^"]+)"/g)].map(([, id]) => id);
    expect(new Set(ids).size).toBe(2);
  });
});

describe("MoneyField", () => {
  it("shows the starting amount grouped in the locale's notation", () => {
    expect(getInput(renderToStaticMarkup(<MoneyField id="m" name="m" label="M" defaultValue="1200" locale="pl" />))).toContain(
      'value="1 200,00"',
    );
    expect(getInput(renderToStaticMarkup(<MoneyField id="m" name="m" label="M" defaultValue="1200.5" />))).toContain(
      'value="1,200.50"',
    );
  });

  it("leaves a value it cannot parse as typed", () => {
    expect(getInput(renderToStaticMarkup(<MoneyField id="m" name="m" label="M" defaultValue="12x" />))).toContain('value="12x"');
  });

  it("is a decimal text input with equal-width digits and a currency suffix", () => {
    const html = renderToStaticMarkup(<MoneyField id="m" name="m" label="M" suffix="PLN" error="Bad" />);
    const input = getInput(html);
    expect(input).toContain('type="text"');
    expect(input).toContain('inputMode="decimal"');
    expect(input).toContain("sft:tabular-nums");
    expect(input).toContain('aria-invalid="true"');
    expect(html).toContain(">PLN</span>");
  });
});

describe("PasswordField", () => {
  it("is required, takes no default and never replays a submitted password", () => {
    const html = renderToStaticMarkup(
      withReplay({ values: { password: "secret" } }, <PasswordField id="p" name="password" label="Password" minLength={12} autoComplete="new-password" />),
    );
    const input = getInput(html);
    for (const attribute of ['type="password"', 'required=""', 'minLength="12"', 'autoComplete="new-password"']) {
      expect(input).toContain(attribute);
    }
    expect(input).not.toContain("value=");
    expect(html).not.toContain("secret");
  });

  it("shows an error the same way as other fields", () => {
    expect(getInput(renderToStaticMarkup(<PasswordField id="p" name="p" label="P" error="Too short" />))).toContain(
      'aria-describedby="p-error"',
    );
  });
});

describe("SelectField", () => {
  const OPTIONS = [
    { value: "pln", label: "PLN" },
    { value: "eur", label: "EUR" },
  ];

  it("renders the product's Select named by the label, with its own id", () => {
    const html = renderToStaticMarkup(<SelectField id="cur-1" name="currency" label="Currency" options={OPTIONS} defaultValue="eur" />);
    expect(html).toMatch(/<label for="cur-1"/);
    expect(html).toMatch(/id="cur-1" role="combobox"/);
    expect(html).toContain('<input type="hidden" name="currency" value="eur"/>');
    expect(html).not.toContain("<select");
  });

  it("gives a custom id its own hint id", () => {
    const html = renderToStaticMarkup(<SelectField id="cur-2" name="currency" label="Currency" options={OPTIONS} hint="h" />);
    expect(html).toContain('id="cur-2-hint"');
    expect(html).toMatch(/role="combobox"[^>]*aria-describedby="cur-2-hint"/);
  });

  it("replays the submitted option", () => {
    const html = renderToStaticMarkup(withReplay({ values: { currency: "eur" } }, <SelectField name="currency" label="C" options={OPTIONS} />));
    expect(html).toContain('name="currency" value="eur"');
  });
});

describe("CheckboxField", () => {
  it("is a switch by default and a checkbox for a statement", () => {
    expect(renderToStaticMarkup(<CheckboxField name="n" label="Notify" />)).toContain('role="switch"');
    const statement = renderToStaticMarkup(<CheckboxField name="consent" label="I agree" labelAs="statement" hint="Required" />);
    expect(statement).not.toContain('role="switch"');
    expect(statement).toContain(">Required</span>");
  });

  it("after a rejected submit takes its state from the submitted names, not from the data", () => {
    expect(getInput(renderToStaticMarkup(withReplay({ values: { other: "x" } }, <CheckboxField name="n" label="N" defaultChecked />)))).not.toContain(
      'checked=""',
    );
    expect(getInput(renderToStaticMarkup(withReplay({ values: { n: "on" } }, <CheckboxField name="n" label="N" />)))).toContain('checked=""');
  });
});

describe("getCheckedAfterSubmit", () => {
  it("uses the data before a submit (or after a successful one)", () => {
    expect(getCheckedAfterSubmit(null, "n", true)).toBe(true);
    expect(getCheckedAfterSubmit(null, "n", false)).toBe(false);
  });

  it("uses the presence of the name after a rejected submit", () => {
    expect(getCheckedAfterSubmit(new Set(["n"]), "n", false)).toBe(true);
    expect(getCheckedAfterSubmit(new Set(["other"]), "n", true)).toBe(false);
  });
});
