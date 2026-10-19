// @vitest-environment happy-dom
import { authMessages, type AuthFormState } from "@softure-ai/auth";
import {
  ChangePasswordForm,
  ForgotPasswordForm,
  LoginForm,
  RegisterForm,
  ResetPasswordForm,
  type AuthFormAction,
} from "@softure-ai/auth/ui";
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

  it("renders the app's extra fields and its consent label with a link to the terms", () => {
    render(
      <RegisterForm
        action={answering({ status: "idle" })}
        messages={en}
        requireConsent
        minPasswordLength={10}
        consentLabel={
          <>
            {en.fields.consent} <a href="/terms">{en.login.registerLink}</a>
          </>
        }
        extraFields={<input type="hidden" name="z" value="newsletter" />}
      />,
    );
    expect(document.querySelector('input[name="z"]')).toHaveProperty("value", "newsletter");
    expect(screen.getByRole("link", { name: en.login.registerLink })).toHaveProperty("href", expect.stringContaining("/terms") as string);
    // The extra fields sit inside the form, before the consent checkbox.
    const form = document.querySelector("form");
    expect(form?.contains(document.querySelector('input[name="z"]'))).toBe(true);
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

describe("RegisterForm consent box", () => {
  it("shows the consent message under an unticked box instead of the browser's bubble, and clears it when ticked", () => {
    render(<RegisterForm action={answering({ status: "idle" })} messages={en} requireConsent minPasswordLength={10} />);
    const box = screen.getByLabelText(en.fields.consent);
    const isNotCancelled = fireEvent.invalid(box);
    expect(isNotCancelled).toBe(false);
    expect(screen.getByText(en.errors.auth.consent_required)).toBeDefined();
    expect(box.getAttribute("aria-invalid")).toBe("true");
    fireEvent.click(box);
    expect(screen.queryByText(en.errors.auth.consent_required)).toBeNull();
  });

  it("takes the app's id and look, and shows the server's consent error at that id", async () => {
    const action = answering({ status: "error", error: "auth.consent_required", field: "consent", email: "ada@example.com" });
    render(
      <RegisterForm
        action={action}
        messages={en}
        requireConsent
        minPasswordLength={10}
        consentProps={{ id: "field-consent", classNames: { root: "app-consent" } }}
      />,
    );
    expect(document.querySelector("#field-consent")).toBe(screen.getByLabelText(en.fields.consent));
    expect(document.querySelector("#field-consent")?.closest(".app-consent")).not.toBeNull();
    await submit(screen.getByRole("button", { name: en.register.submit }));
    expect(document.querySelector("#field-consent-error")?.textContent).toBe(en.errors.auth.consent_required);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows an error for a field it does not render as the form error", async () => {
    const action = answering({ status: "error", error: "auth.consent_required", field: "consent" });
    render(<RegisterForm action={action} messages={en} requireConsent={false} minPasswordLength={10} />);
    await submit(screen.getByRole("button", { name: en.register.submit }));
    expect(screen.getByRole("alert").textContent).toBe(en.errors.auth.consent_required);
  });
});

describe("field looks", () => {
  it("passes fieldClassNames and fieldHintProps to every text and password field", () => {
    const { unmount } = render(
      <RegisterForm
        action={answering({ status: "idle" })}
        messages={en}
        requireConsent
        minPasswordLength={10}
        fieldClassNames={{ label: "app-label", hint: "app-hint" }}
      />,
    );
    expect(screen.getByText(en.fields.email).className).toContain("app-label");
    expect(screen.getByText(en.fields.password).className).toContain("app-label");
    expect(screen.getByText("At least 10 characters.").className).toContain("app-hint");
    unmount();
    render(<LoginForm action={answering({ status: "idle" })} messages={en} fieldClassNames={{ label: "app-label" }} />);
    expect(screen.getByText(en.fields.email).className).toContain("app-label");
    expect(screen.getByText(en.fields.password).className).toContain("app-label");
  });

  it("shows the password hint as a tooltip in the app's look with fieldHintAs and fieldHintProps", () => {
    render(
      <ChangePasswordForm
        action={answering({ status: "idle" })}
        messages={en}
        minPasswordLength={10}
        fieldHintAs="tooltip"
        fieldHintProps={{ classNames: { trigger: "app-hint-trigger" } }}
      />,
    );
    expect(document.querySelectorAll(".app-hint-trigger")).toHaveLength(1);
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

describe("the submit button", () => {
  it("is primary by default and takes the app's variant and class", () => {
    const { unmount } = render(<LoginForm action={answering({ status: "idle" })} messages={en} />);
    expect(screen.getByRole("button", { name: en.login.submit }).getAttribute("data-variant")).toBe("primary");
    unmount();
    render(
      <ChangePasswordForm
        action={answering({ status: "idle" })}
        messages={en}
        minPasswordLength={10}
        submitVariant="secondary"
        classNames={{ submit: "app-submit" }}
      />,
    );
    const button = screen.getByRole("button", { name: en.changePassword.submit });
    expect(button.getAttribute("data-variant")).toBe("secondary");
    expect(button.className).toContain("app-submit");
  });
});

describe("the auth forms' submit button while sending", () => {
  const idle = () => answering({ status: "idle" });

  it.each([
    { form: "LoginForm", copy: en.login, view: () => <LoginForm action={idle()} messages={en} /> },
    { form: "RegisterForm", copy: en.register, view: () => <RegisterForm action={idle()} messages={en} requireConsent={false} minPasswordLength={10} /> },
    { form: "ChangePasswordForm", copy: en.changePassword, view: () => <ChangePasswordForm action={idle()} messages={en} minPasswordLength={10} /> },
    { form: "ForgotPasswordForm", copy: en.forgotPassword, view: () => <ForgotPasswordForm action={idle()} messages={en} ttlMinutes={30} /> },
    { form: "ResetPasswordForm", copy: en.resetPassword, view: () => <ResetPasswordForm action={idle()} messages={en} token="t" minPasswordLength={10} /> },
  ])("$form reserves the pending label's width while idle", ({ copy, view }) => {
    render(view());
    const button = screen.getByRole("button", { name: copy.submit });
    expect(button.querySelector("[data-reserve]")?.getAttribute("data-reserve")).toBe(copy.pending);
  });

  it("shows the pending label and reserves the idle one while the action runs", async () => {
    let finish: (state: AuthFormState) => void = () => undefined;
    const action = vi.fn<AuthFormAction>(() => new Promise((resolve) => (finish = resolve)));
    render(<LoginForm action={action} messages={en} />);
    await submit(screen.getByRole("button", { name: en.login.submit }));
    try {
      const button = screen.getByRole("button", { name: en.login.pending });
      expect(button.getAttribute("aria-busy")).toBe("true");
      expect(button.querySelector("[data-reserve]")?.getAttribute("data-reserve")).toBe(en.login.submit);
    } finally {
      // A pending async action holds back every later form action in React, so it always settles here.
      await act(async () => {
        finish({ status: "idle" });
        await Promise.resolve();
      });
    }
  });
});
