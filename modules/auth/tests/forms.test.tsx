// @vitest-environment happy-dom
import { authMessages, type AuthFormState } from "@softure-ai/auth";
import { ChangePasswordForm, LoginForm, RegisterForm, type AuthFormAction } from "@softure-ai/auth/ui";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(cleanup);

const en = authMessages.en;

function answering(state: AuthFormState) {
  return vi.fn<AuthFormAction>(() => Promise.resolve(state));
}

async function submit(button: HTMLElement): Promise<void> {
  await act(async () => {
    fireEvent.submit(button.closest("form") ?? button);
    await Promise.resolve();
  });
}

describe("LoginForm", () => {
  it("renders labelled fields, the next path and the register link", () => {
    render(<LoginForm action={answering({ status: "idle" })} messages={en} next="/account" registerHref="/register" />);
    expect(screen.getByLabelText(en.fields.email)).toHaveProperty("type", "email");
    expect(screen.getByLabelText(en.fields.password)).toHaveProperty("type", "password");
    expect(document.querySelector('input[name="next"]')).toHaveProperty("value", "/account");
    expect(screen.getByRole("link", { name: en.login.registerLink })).toHaveProperty("href", expect.stringContaining("/register") as string);
  });

  it("shows a rejected login as a form error and keeps the email", async () => {
    const action = answering({ status: "error", error: "auth.invalid_credentials", email: "ada@example.com" });
    render(<LoginForm action={action} messages={en} />);
    await submit(screen.getByRole("button", { name: en.login.submit }));
    expect(screen.getByRole("alert").textContent).toBe(en.errors.auth.invalid_credentials);
    expect(screen.getByLabelText(en.fields.email)).toHaveProperty("value", "ada@example.com");
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("has no register link when none is given", () => {
    render(<LoginForm action={answering({ status: "idle" })} messages={en} />);
    expect(screen.queryByRole("link")).toBeNull();
  });
});

describe("RegisterForm", () => {
  it("asks for consent and shows the password policy", () => {
    render(<RegisterForm action={answering({ status: "idle" })} messages={en} requireConsent minPasswordLength={12} loginHref="/login" />);
    expect(screen.getByLabelText(en.fields.consent)).toHaveProperty("required", true);
    expect(screen.getByLabelText(en.fields.password)).toHaveProperty("minLength", 12);
    expect(screen.getByText("At least 12 characters.")).toBeDefined();
  });

  it("leaves the checkbox out when consent is not required", () => {
    render(<RegisterForm action={answering({ status: "idle" })} messages={en} requireConsent={false} minPasswordLength={10} />);
    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  it("shows a field error at its field, not as a form error", async () => {
    const action = answering({ status: "error", error: "auth.email_taken", field: "email", email: "ada@example.com" });
    render(<RegisterForm action={action} messages={en} requireConsent minPasswordLength={10} />);
    await submit(screen.getByRole("button", { name: en.register.submit }));
    expect(screen.getByText(en.errors.auth.email_taken)).toBeDefined();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByLabelText(en.fields.email).getAttribute("aria-invalid")).toBe("true");
  });
});

describe("ChangePasswordForm", () => {
  it("confirms a change", async () => {
    render(<ChangePasswordForm action={answering({ status: "ok" })} messages={en} minPasswordLength={10} />);
    await submit(screen.getByRole("button", { name: en.changePassword.submit }));
    expect(screen.getByRole("status").textContent).toBe(en.changePassword.success);
  });

  it("shows a wrong current password at that field", async () => {
    render(
      <ChangePasswordForm
        action={answering({ status: "error", error: "auth.current_password_invalid", field: "currentPassword" })}
        messages={en}
        minPasswordLength={10}
      />,
    );
    await submit(screen.getByRole("button", { name: en.changePassword.submit }));
    expect(screen.getByLabelText(en.fields.currentPassword).getAttribute("aria-invalid")).toBe("true");
  });
});
