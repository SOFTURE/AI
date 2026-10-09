import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CheckboxField } from "../src/index.js";
import { FormReplayProvider } from "../src/ui/form-context.js";

// Issue 340: `CheckboxField` forwards the app's look to the `Switch` or `Checkbox` it renders, so an app can use
// it under `unstyled` instead of keeping its own copy of the submit replay.

function getInput(html: string): string {
  return html.match(/<input [^>]*>/)?.[0] ?? "";
}

describe("CheckboxField forwards the control's look (#340)", () => {
  it("passes switchProps slots to the Switch and its SwitchControl under unstyled", () => {
    const html = renderToStaticMarkup(
      <CheckboxField
        name="notify"
        label="Notify me"
        unstyled
        switchProps={{
          classNames: { root: "app-switch", label: "app-switch-label", description: "app-switch-description" },
          controlClassNames: { input: "app-switch-input", track: "app-switch-track" },
        }}
        hint="Once a day"
      />,
    );
    expect(html).toContain('class="sft:group/switch app-switch"');
    expect(html).toContain('class="app-switch-label"');
    expect(html).toContain('class="app-switch-description"');
    expect(getInput(html)).toContain('class="app-switch-input"');
    expect(html).toContain('class="app-switch-track"');
    expect(html).not.toContain("sft:rounded-control");
  });

  it("passes switchProps.hintProps to the tooltip hint", () => {
    const html = renderToStaticMarkup(
      <CheckboxField
        name="notify"
        label="Notify me"
        hint="Once a day"
        hintAs="tooltip"
        switchProps={{ classNames: { hint: "app-hint-wrap" }, hintProps: { classNames: { trigger: "app-hint-trigger" } } }}
      />,
    );
    expect(html).toContain("app-hint-wrap");
    expect(html).toContain("app-hint-trigger");
  });

  it("passes checkboxProps slots to the Checkbox in statement mode under unstyled", () => {
    const html = renderToStaticMarkup(
      <CheckboxField
        name="consent"
        label="I agree"
        labelAs="statement"
        hint="Required"
        unstyled
        checkboxProps={{ classNames: { root: "app-check", input: "app-check-input", description: "app-check-description" } }}
      />,
    );
    expect(html).toContain('<div class="app-check">');
    expect(getInput(html)).toContain('class="app-check-input"');
    expect(html).toContain('class="app-check-description"');
    expect(html).not.toContain("sft:");
  });

  it("keeps the submit replay with the app's look", () => {
    const html = renderToStaticMarkup(
      <FormReplayProvider replay={{ values: { consent: "on" }, fieldErrors: {}, submitCount: 1, hasReplay: true }}>
        <CheckboxField name="consent" label="I agree" labelAs="statement" unstyled checkboxProps={{ classNames: { input: "app-check-input" } }} />
      </FormReplayProvider>,
    );
    expect(getInput(html)).toContain('checked=""');
    expect(getInput(html)).toContain('class="app-check-input"');
  });
});
