// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { formatMessage } from "@softure-ai/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CheckboxField,
  ColorField,
  ConfirmActionButton,
  type ConfirmActionResult,
  normalizeHexColor,
  SuggestedAmountField,
  UiLocaleProvider,
  uiMessages,
} from "../src/index.js";

// Issue #407: generic components an adopting app still owned.

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("CheckboxField required with requiredMessage (#407.2)", () => {
  function renderConsent(props: { requiredMessage?: string } = {}) {
    render(
      <form aria-label="Sign up">
        <input name="email" aria-label="Email" />
        <CheckboxField name="terms" label="I accept the terms" labelAs="statement" required {...props} />
        <button type="submit">Create account</button>
      </form>,
    );
    return screen.getByRole("checkbox", { name: "I accept the terms" });
  }

  it("shows the message on the native invalid event, marks the box invalid and moves focus to it", () => {
    const box = renderConsent({ requiredMessage: "Accept the terms to continue." });
    expect(box).toHaveProperty("required", true);
    const invalid = new Event("invalid", { cancelable: true });
    act(() => {
      box.dispatchEvent(invalid);
    });
    expect(invalid.defaultPrevented).toBe(true);
    expect(screen.getByText("Accept the terms to continue.")).toBeDefined();
    expect(box.getAttribute("aria-invalid")).toBe("true");
    expect(box.getAttribute("aria-describedby")).toBe(screen.getByText("Accept the terms to continue.").id);
    expect(document.activeElement).toBe(box);
  });

  it("leaves focus on an earlier invalid control", () => {
    render(
      <form aria-label="Sign up">
        <input name="email" aria-label="Email" required />
        <CheckboxField name="terms" label="I accept the terms" labelAs="statement" required requiredMessage="Accept the terms." />
      </form>,
    );
    const email = screen.getByRole("textbox", { name: "Email" });
    email.focus();
    act(() => {
      screen.getByRole("checkbox", { name: "I accept the terms" }).dispatchEvent(new Event("invalid", { cancelable: true }));
    });
    expect(screen.getByText("Accept the terms.")).toBeDefined();
    expect(document.activeElement).toBe(email);
  });

  it("clears the message once the box is checked", () => {
    const box = renderConsent({ requiredMessage: "Accept the terms to continue." });
    act(() => {
      box.dispatchEvent(new Event("invalid", { cancelable: true }));
    });
    expect(screen.getByText("Accept the terms to continue.")).toBeDefined();
    fireEvent.click(box);
    expect(screen.queryByText("Accept the terms to continue.")).toBeNull();
    expect(box.getAttribute("aria-invalid")).toBeNull();
  });

  it("keeps the browser's own validation without requiredMessage", () => {
    const box = renderConsent();
    const invalid = new Event("invalid", { cancelable: true });
    box.dispatchEvent(invalid);
    expect(invalid.defaultPrevented).toBe(false);
    expect(box.getAttribute("aria-invalid")).toBeNull();
  });

  it("passes required to the switch of a setting", () => {
    render(<CheckboxField name="alerts" label="Alerts" required />);
    expect(screen.getByRole("switch", { name: "Alerts" })).toHaveProperty("required", true);
  });
});

describe("ColorField (#407.5)", () => {
  it("normalizes hex colours", () => {
    expect(normalizeHexColor("#A1B2C3")).toBe("#a1b2c3");
    expect(normalizeHexColor(" #abc ")).toBe("#aabbcc");
    expect(normalizeHexColor("a1b2c3")).toBe("#a1b2c3");
    expect(normalizeHexColor("#12345")).toBeNull();
    expect(normalizeHexColor("#ggg")).toBeNull();
    expect(normalizeHexColor("")).toBeNull();
  });

  it("sends the hex text under name and keeps the swatch in sync both ways", () => {
    const onValueChange = vi.fn<(value: string) => void>();
    render(<ColorField name="brand" label="Brand colour" defaultValue="#336699" onValueChange={onValueChange} />);
    const text = screen.getByRole("textbox", { name: "Brand colour" });
    const swatch = screen.getByLabelText("Pick a colour: Brand colour");
    expect(text).toHaveProperty("name", "brand");
    expect(swatch.getAttribute("name")).toBeNull();
    expect(swatch).toHaveProperty("value", "#336699");

    fireEvent.change(swatch, { target: { value: "#ff0000" } });
    expect(text).toHaveProperty("value", "#ff0000");
    expect(onValueChange).toHaveBeenLastCalledWith("#ff0000");

    fireEvent.change(text, { target: { value: "#0F0" } });
    fireEvent.blur(text);
    expect(text).toHaveProperty("value", "#00ff00");
    expect(swatch).toHaveProperty("value", "#00ff00");
  });

  it("leaves text it cannot read as typed, for the pattern to reject", () => {
    render(<ColorField name="brand" label="Brand colour" defaultValue="#336699" />);
    const text = screen.getByRole("textbox", { name: "Brand colour" });
    expect(text.getAttribute("pattern")).toBe("#[0-9a-fA-F]{6}");
    fireEvent.change(text, { target: { value: "blue" } });
    fireEvent.blur(text);
    expect(text).toHaveProperty("value", "blue");
    expect(screen.getByLabelText("Pick a colour: Brand colour")).toHaveProperty("value", "#336699");
  });

  it("names the swatch in Polish from the provider", () => {
    render(
      <UiLocaleProvider locale="pl">
        <ColorField name="brand" label="Brand" />
      </UiLocaleProvider>,
    );
    expect(screen.getByLabelText(formatMessage(uiMessages.pl.colorField.picker, { label: "Brand" }))).toBeDefined();
  });
});

describe("SuggestedAmountField (#407.5)", () => {
  it("fills the suggested amount from the chip, in the locale's notation", () => {
    const onValueChange = vi.fn<(value: string) => void>();
    render(
      <SuggestedAmountField
        name="budget"
        label="Monthly budget"
        locale="pl"
        suffix="PLN"
        suggestedValue="1234.5"
        onValueChange={onValueChange}
      />,
    );
    const input = screen.getByRole("textbox", { name: "Monthly budget" });
    expect(input).toHaveProperty("value", "");
    fireEvent.click(screen.getByRole("button", { name: formatMessage(uiMessages.pl.suggestedAmount.use, { amount: "1 234,50 PLN" }) }));
    expect(input).toHaveProperty("value", "1 234,50");
    expect(onValueChange).toHaveBeenLastCalledWith("1 234,50");
    expect(document.activeElement).toBe(input);
  });

  it("takes the chip's label from the caller and keeps typed text", () => {
    render(<SuggestedAmountField name="budget" label="Budget" suggestedValue="100" suggestionLabel="Use last month's" />);
    const input = screen.getByRole("textbox", { name: "Budget" });
    fireEvent.change(input, { target: { value: "50" } });
    expect(input).toHaveProperty("value", "50");
    fireEvent.click(screen.getByRole("button", { name: "Use last month's" }));
    expect(input).toHaveProperty("value", "100.00");
  });
});

describe("ConfirmActionButton formAction (#407 comment)", () => {
  it("posts the hidden fields as form data from the confirm button", async () => {
    const formAction = vi.fn((formData: FormData) =>
      Promise.resolve<ConfirmActionResult>(
        formData.get("id") === "42" ? { ok: true, message: "Deleted." } : { ok: false, error: "Wrong id." },
      ),
    );
    const onSuccess = vi.fn();
    render(
      <ConfirmActionButton
        label="Delete"
        title="Delete this goal?"
        description="This cannot be undone."
        confirmLabel="Delete"
        formAction={formAction}
        fields={{ id: "42" }}
        onSuccess={onSuccess}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    const dialog = screen.getByRole("dialog", { name: "Delete this goal?" });
    const confirm = Array.from(dialog.querySelectorAll("button")).find((button) => button.textContent === "Delete");
    expect(confirm?.getAttribute("type")).toBe("submit");
    fireEvent.click(confirm as HTMLButtonElement);
    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
    expect(formAction).toHaveBeenCalledOnce();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("keeps the dialog open with the error when the form action fails", async () => {
    render(
      <ConfirmActionButton
        label="Delete"
        title="Delete this goal?"
        description="This cannot be undone."
        confirmLabel="Confirm"
        formAction={() => Promise.resolve<ConfirmActionResult>({ ok: false, error: "Already gone." })}
        fields={{ id: "7" }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(await screen.findByText("Already gone.")).toBeDefined();
    expect(screen.getByRole("dialog")).toBeDefined();
  });
});
