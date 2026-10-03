// @vitest-environment happy-dom
import { type DeleteAccountFormState, privacyMessages } from "@softure-ai/privacy";
import { type DeleteAccountAction, DeleteAccountForm } from "@softure-ai/privacy/ui";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(cleanup);

const en = privacyMessages.en;

function answering(state: DeleteAccountFormState) {
  return vi.fn<DeleteAccountAction>(() => Promise.resolve(state));
}

async function submit(): Promise<void> {
  await act(async () => {
    fireEvent.submit(screen.getByRole("button", { name: en.delete.submit }).closest("form") as HTMLFormElement);
    await Promise.resolve();
  });
}

describe("DeleteAccountForm", () => {
  it("asks for the current password and a required confirmation, and warns that it cannot be undone", () => {
    render(<DeleteAccountForm action={answering({ status: "idle" })} messages={en} />);
    expect(screen.getByText(en.delete.description)).toBeDefined();
    expect(screen.getByLabelText(en.delete.password)).toHaveProperty("type", "password");
    expect(screen.getByRole("checkbox", { name: en.delete.confirm })).toHaveProperty("required", true);
    expect(screen.getByRole("button", { name: en.delete.submit })).toBeDefined();
  });

  it("sends the password and the confirmation to the action", async () => {
    const action = answering({ status: "idle" });
    render(<DeleteAccountForm action={action} messages={en} />);
    fireEvent.change(screen.getByLabelText(en.delete.password), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("checkbox", { name: en.delete.confirm }));
    await submit();
    const formData = action.mock.calls[0]?.[1];
    expect(formData?.get("password")).toBe("secret");
    expect(formData?.get("confirm")).toBe("on");
  });

  it("shows a wrong password under the password field", async () => {
    render(<DeleteAccountForm action={answering({ status: "error", error: "privacy.password_invalid", field: "password" })} messages={en} />);
    await submit();
    expect(screen.getByLabelText(en.delete.password).getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByText(en.errors.privacy.password_invalid)).toBeDefined();
  });

  it("shows a refusal for the whole form", async () => {
    render(<DeleteAccountForm action={answering({ status: "error", error: "privacy.deletion_refused" })} messages={en} />);
    await submit();
    expect(screen.getByText(en.errors.privacy.deletion_refused)).toBeDefined();
  });
});
