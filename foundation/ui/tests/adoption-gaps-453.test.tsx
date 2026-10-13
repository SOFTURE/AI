// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CheckboxField } from "../src/index.js";

// Issue #453: a consent statement links to the terms, so `CheckboxField` takes a node as its label.

afterEach(() => {
  cleanup();
});

const TERMS_LABEL = (
  <>
    I accept the <a href="/terms">terms</a>
  </>
);

describe("CheckboxField with a node label (#453)", () => {
  it("renders a statement's link inside the box's label, named by the label's text", () => {
    render(<CheckboxField name="terms" label={TERMS_LABEL} labelAs="statement" required requiredMessage="Accept the terms." />);

    const box = screen.getByRole("checkbox", { name: "I accept the terms" });
    const link = screen.getByRole("link", { name: "terms" });
    expect(link.getAttribute("href")).toBe("/terms");
    expect(link.closest("label")?.getAttribute("for")).toBe(box.id);
  });

  it("renders a setting's node label as the switch's name", () => {
    render(<CheckboxField name="alerts" label={<strong>Alerts</strong>} />);

    expect(screen.getByRole("switch", { name: "Alerts" })).toBeDefined();
  });

  it("names a setting's tooltip trigger with switchProps.hintLabel when the label is a node", () => {
    render(
      <CheckboxField
        name="alerts"
        label={<strong>Alerts</strong>}
        hint="Sent by email."
        hintAs="tooltip"
        switchProps={{ hintLabel: "About alerts" }}
      />,
    );

    expect(screen.getByRole("button", { name: "About alerts" })).toBeDefined();
  });
});
