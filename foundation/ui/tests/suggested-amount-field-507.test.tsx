// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SuggestedAmountField, UiLocaleProvider } from "../src/index.js";

// Issue #507: a no-suggestion state, an explanation hint and an inline layout.

afterEach(() => {
  cleanup();
});

describe("SuggestedAmountField without a suggestion (#507.1)", () => {
  it("shows the no-suggestion text and no action when the suggestion is null", () => {
    render(<SuggestedAmountField name="budget" label="Budget" suggestedValue={null} />);
    expect(screen.getByText("No suggestion")).toBeDefined();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("treats a missing suggestion as none, in the inline variant too", () => {
    render(<SuggestedAmountField name="budget" label="Budget" suggestionVariant="inline" />);
    expect(screen.getByText("No suggestion")).toBeDefined();
    expect(screen.queryByText(/Suggested:/)).toBeNull();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("explains the missing suggestion with a hint named by noneHintLabel", () => {
    render(<SuggestedAmountField name="budget" label="Budget" suggestedValue={null} suggestionHint="Not enough data yet." />);
    const trigger = screen.getByRole("button", { name: "Why there is no suggestion: Budget" });
    expect(screen.getByRole("tooltip", { hidden: true }).textContent).toBe("Not enough data yet.");
    expect(trigger.getAttribute("aria-describedby")).toBe(screen.getByRole("tooltip", { hidden: true }).id);
  });
});

describe("SuggestedAmountField suggestion hint (#507.2)", () => {
  it("puts the hint after the chip, named by hintLabel, and keeps the chip as before", () => {
    render(
      <SuggestedAmountField
        name="budget"
        label="Budget"
        suggestedValue="100"
        suggestionHint="Last month's spending."
        suggestionHintProps={{ isWide: true }}
      />,
    );
    const chip = screen.getByRole("button", { name: "Use 100.00" });
    const hint = screen.getByRole("button", { name: "Where the suggestion comes from: Budget" });
    expect(chip.parentElement).toBe(hint.parentElement?.parentElement);
    expect(chip.compareDocumentPosition(hint) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole("tooltip", { hidden: true }).className).toContain("sft:w-88");
  });

  it("renders no hint when none is given", () => {
    render(<SuggestedAmountField name="budget" label="Budget" suggestedValue="100" />);
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.queryByRole("tooltip", { hidden: true })).toBeNull();
  });
});

describe("SuggestedAmountField inline variant (#507.3)", () => {
  function renderInline(props: Partial<Parameters<typeof SuggestedAmountField>[0]> = {}) {
    render(
      <SuggestedAmountField
        name="budget"
        label="Budget"
        locale="pl"
        suffix="PLN"
        suggestedValue="120000"
        suggestionVariant="inline"
        suggestionHint="Your plan's monthly amount."
        classNames={{ suggestionRow: "app-row" }}
        {...props}
      />,
    );
  }

  it("renders the label, a text button and the hint in one row", () => {
    renderInline();
    const row = document.querySelector(".app-row");
    expect(row?.textContent).toBe("Suggested: 120 000,00 PLNuse?Your plan's monthly amount.");
    expect(row?.className).toContain("sft:text-muted");
    const action = screen.getByRole("button", { name: "Use 120 000,00 PLN" });
    expect(action.textContent).toBe("use");
    expect(action.getAttribute("type")).toBe("button");
    expect(screen.getByRole("button", { name: "Where the suggestion comes from: Budget" })).toBeDefined();
  });

  it("fills the field and focuses it from the text button", () => {
    renderInline();
    const input = screen.getByRole("textbox", { name: "Budget" });
    fireEvent.click(screen.getByRole("button", { name: "Use 120 000,00 PLN" }));
    expect(input).toHaveProperty("value", "120 000,00");
    expect(document.activeElement).toBe(input);
  });

  it("takes suggestionLabel as the button's text and name", () => {
    renderInline({ suggestionLabel: "take it" });
    expect(screen.getByRole("button", { name: "take it" }).textContent).toBe("take it");
  });
});

describe("SuggestedAmountField copy overrides (#507)", () => {
  it("takes every new text from suggestionMessages", () => {
    render(
      <SuggestedAmountField
        name="budget"
        label="Budget"
        suggestedValue="5"
        suggestionVariant="inline"
        suggestionHint="Why."
        suggestionMessages={{ suggested: "Proposed {amount}", useShort: "apply", use: "Apply {amount}", hintLabel: "Source: {label}" }}
      />,
    );
    expect(screen.getByText("Proposed 5.00")).toBeDefined();
    expect(screen.getByRole("button", { name: "Apply 5.00" }).textContent).toBe("apply");
    expect(screen.getByRole("button", { name: "Source: Budget" })).toBeDefined();
  });

  it("takes the no-suggestion texts from the provider", () => {
    render(
      <UiLocaleProvider messages={{ suggestedAmount: { none: "Nothing to suggest", noneHintLabel: "Why not: {label}" } }}>
        <SuggestedAmountField name="budget" label="Budget" suggestedValue={null} suggestionHint="Too little data." />
      </UiLocaleProvider>,
    );
    expect(screen.getByText("Nothing to suggest")).toBeDefined();
    expect(screen.getByRole("button", { name: "Why not: Budget" })).toBeDefined();
  });
});
