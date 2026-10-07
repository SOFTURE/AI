// @vitest-environment happy-dom
import { getScopeFieldName, waitlistMessages, type WaitlistFormState } from "@softure-ai/waitlist";
import { type WaitlistFormAction, WaitlistForm, type WaitlistFormScope } from "@softure-ai/waitlist/ui";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(cleanup);

const en = waitlistMessages.en;
const SCOPES: WaitlistFormScope[] = [
  { id: "launch", label: "Tell me when it opens.", required: true },
  { id: "newsletter", label: <>Send me the <a href="/legal/privacy">newsletter</a>.</>, required: false },
];

function answering(state: WaitlistFormState) {
  return vi.fn<WaitlistFormAction>(() => Promise.resolve(state));
}

function renderForm(action: WaitlistFormAction) {
  return render(<WaitlistForm action={action} scopes={SCOPES} placement="hero" messages={en} />);
}

async function submit(): Promise<void> {
  await act(async () => {
    fireEvent.submit(screen.getByRole("button", { name: en.form.submit }).closest("form") as HTMLFormElement);
    await Promise.resolve();
  });
}

describe("WaitlistForm", () => {
  it("asks for an email and shows one checkbox per scope, required where the config says so", () => {
    renderForm(answering({ status: "idle" }));
    expect(screen.getByLabelText(en.form.email)).toHaveProperty("type", "email");
    expect(screen.getByRole("checkbox", { name: "Tell me when it opens." })).toHaveProperty("required", true);
    expect(screen.getByRole("checkbox", { name: /Send me the/ })).toHaveProperty("required", false);
    expect(screen.getByRole("link", { name: "newsletter" }).getAttribute("href")).toBe("/legal/privacy");
  });

  it("sends the email, the checked scopes and the placement to the action", async () => {
    const action = answering({ status: "idle" });
    renderForm(action);
    fireEvent.change(screen.getByLabelText(en.form.email), { target: { value: "ada@example.com" } });
    fireEvent.click(screen.getByRole("checkbox", { name: "Tell me when it opens." }));
    await submit();
    const formData = action.mock.calls[0]?.[1];
    expect(formData?.get("email")).toBe("ada@example.com");
    expect(formData?.get("placement")).toBe("hero");
    expect(formData?.get(getScopeFieldName("launch"))).toBe("on");
    expect(formData?.has(getScopeFieldName("newsletter"))).toBe(false);
  });

  it("replaces the form with the confirmation after a sign-up", async () => {
    renderForm(answering({ status: "ok" }));
    await submit();
    expect(screen.getByRole("status").textContent).toBe(en.form.success);
    expect(screen.queryByRole("button", { name: en.form.submit })).toBeNull();
  });

  it("shows the person's unsubscribe link under the confirmation when the action returns one", async () => {
    const url = "https://app.example.com/unsubscribe?r=key&t=signature";
    renderForm(answering({ status: "ok", unsubscribeUrl: url }));
    await submit();
    expect(screen.getByRole("status").textContent).toBe(en.form.success);
    expect(screen.getByRole("link", { name: en.form.unsubscribeLink }).getAttribute("href")).toBe(url);
    expect(screen.getByText(en.form.unsubscribeHint, { exact: false })).toBeDefined();
  });

  it("shows no unsubscribe link without one", async () => {
    renderForm(answering({ status: "ok" }));
    await submit();
    expect(screen.queryByRole("link", { name: en.form.unsubscribeLink })).toBeNull();
  });

  it("tells the person to confirm through the mail with double opt-in", async () => {
    renderForm(answering({ status: "confirmation_sent" }));
    await submit();
    expect(screen.getByRole("status").textContent).toBe(en.form.confirmationSent);
    expect(screen.queryByRole("button", { name: en.form.submit })).toBeNull();
  });

  it("shows an invalid address under the field and keeps what was typed and checked", async () => {
    renderForm(answering({ status: "error", error: "waitlist.email_invalid", field: "email", email: "ada.example.com", scopes: ["newsletter"] }));
    await submit();
    const field = screen.getByLabelText(en.form.email);
    expect(field.getAttribute("aria-invalid")).toBe("true");
    expect(field).toHaveProperty("value", "ada.example.com");
    expect(screen.getByText(en.errors.waitlist.email_invalid)).toBeDefined();
    expect(screen.getByRole("checkbox", { name: /Send me the/ })).toHaveProperty("checked", true);
    expect(screen.getByRole("checkbox", { name: "Tell me when it opens." })).toHaveProperty("checked", false);
  });

  it("shows a rate limit refusal for the whole form", async () => {
    renderForm(answering({ status: "error", error: "security.rate_limited" }));
    await submit();
    expect(screen.getByText(en.errors.security.rate_limited)).toBeDefined();
  });
});
