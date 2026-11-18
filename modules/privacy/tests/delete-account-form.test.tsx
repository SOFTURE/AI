// @vitest-environment happy-dom
import { type DeleteAccountFormState, privacyMessages, type PrivacyMessages } from "@softure-ai/privacy";
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
    expect(screen.getByLabelText(en.delete.password)).toHaveProperty("required", true);
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

  describe("with a provider", () => {
    const GITHUB = { id: "github", name: "GitHub" };
    const signInAction = vi.fn<(formData: FormData) => void>();
    const base = { providers: [GITHUB], recentProvider: null, signInAction, next: "/account", isPasswordEnabled: true };

    it("offers to confirm by signing in with the provider again, next to the password", () => {
      render(<DeleteAccountForm action={answering({ status: "idle" })} messages={en} reauthentication={base} />);
      expect(screen.getByText(en.delete.confirmWithLead)).toBeDefined();
      const button = screen.getByRole("button", { name: "Confirm with GitHub" });
      const form = button.closest("form") as HTMLFormElement;
      expect(Object.fromEntries(new FormData(form))).toEqual({ provider: "github", next: "/account" });
      // An account the provider created knows no password, so the browser must let an empty one through.
      expect(screen.getByLabelText(en.delete.password)).toHaveProperty("required", false);
    });

    it("leaves the password field out when the app has no passwords", () => {
      render(<DeleteAccountForm action={answering({ status: "idle" })} messages={en} reauthentication={{ ...base, isPasswordEnabled: false }} />);
      expect(screen.queryByLabelText(en.delete.password)).toBeNull();
      expect(screen.getByRole("button", { name: "Confirm with GitHub" })).toBeDefined();
    });

    it("after a fresh sign-in asks only for the confirmation, and says why", async () => {
      const action = answering({ status: "idle" });
      render(<DeleteAccountForm action={action} messages={en} reauthentication={{ ...base, recentProvider: GITHUB }} />);
      expect(screen.queryByLabelText(en.delete.password)).toBeNull();
      expect(screen.queryByRole("button", { name: "Confirm with GitHub" })).toBeNull();
      expect(screen.getByRole("status").textContent).toBe(en.delete.confirmedWith.replace("{provider}", "GitHub"));
      fireEvent.click(screen.getByRole("checkbox", { name: en.delete.confirm }));
      await submit();
      expect(action.mock.calls[0]?.[1].get("password")).toBeNull();
    });

    it("shows a needed re-authentication for the whole form when there is no password field", async () => {
      render(
        <DeleteAccountForm
          action={answering({ status: "error", error: "privacy.reauthentication_required", field: "password" })}
          messages={en}
          reauthentication={{ ...base, isPasswordEnabled: false }}
        />,
      );
      await submit();
      expect(screen.getByText(en.errors.privacy.reauthentication_required)).toBeDefined();
    });

    it("reads English for the keys a dictionary written before them lacks", () => {
      const olderDelete = Object.fromEntries(
        Object.entries(en.delete).filter(([key]) => !["confirmWith", "confirmWithLead", "confirmedWith"].includes(key)),
      ) as PrivacyMessages["delete"];
      render(<DeleteAccountForm action={answering({ status: "idle" })} messages={{ ...en, delete: olderDelete }} reauthentication={base} />);
      expect(screen.getByRole("button", { name: "Confirm with GitHub" })).toBeDefined();
    });
  });
});
