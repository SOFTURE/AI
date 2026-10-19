// @vitest-environment happy-dom
import { getScopeFieldName, waitlistMessages, type WaitlistFormState, type WaitlistFormSuccessState } from "@softure-ai/waitlist";
import { type WaitlistFormAction, WaitlistForm, type WaitlistFormScope } from "@softure-ai/waitlist/ui";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { StrictMode } from "react";
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

  it("tells how long to wait when the refusal carries it, in whole minutes rounded up", async () => {
    renderForm(answering({ status: "error", error: "security.rate_limited", retryAfterSeconds: 61 }));
    await submit();
    expect(screen.getByText("Too many attempts. Try again in 2 min.")).toBeDefined();
    cleanup();
    renderForm(answering({ status: "error", error: "security.rate_limited", retryAfterSeconds: 30 }));
    await submit();
    expect(screen.getByText("Too many attempts. Try again in 1 min.")).toBeDefined();
  });

  it("uses the app's copy for the wait", async () => {
    const messages = { ...en, form: { ...en.form, retryAfter: "Slow down: {minutes} minutes to go." } };
    render(<WaitlistForm action={answering({ status: "error", error: "security.rate_limited", retryAfterSeconds: 600 })} scopes={SCOPES} placement="hero" messages={messages} />);
    await submit();
    expect(screen.getByText("Slow down: 10 minutes to go.")).toBeDefined();
  });
});

describe("WaitlistForm after a sign-up, in the app's own view", () => {
  function renderWith(action: WaitlistFormAction, props: Partial<Parameters<typeof WaitlistForm>[0]>) {
    return render(<WaitlistForm action={action} scopes={SCOPES} placement="hero" messages={en} {...props} />);
  }

  it("calls onSuccess exactly once with the sign-up's state", async () => {
    const onSuccess = vi.fn<(state: WaitlistFormSuccessState) => void>();
    const url = "https://app.example.com/unsubscribe?r=key&t=signature";
    renderWith(answering({ status: "ok", unsubscribeUrl: url }), { onSuccess });
    await submit();
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledWith({ status: "ok", unsubscribeUrl: url });
  });

  it("calls onSuccess once under Strict Mode too", async () => {
    const onSuccess = vi.fn<(state: WaitlistFormSuccessState) => void>();
    render(
      <StrictMode>
        <WaitlistForm action={answering({ status: "ok" })} scopes={SCOPES} placement="hero" messages={en} onSuccess={onSuccess} />
      </StrictMode>,
    );
    await submit();
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it("calls onSuccess when the address waits for its confirmation link", async () => {
    const onSuccess = vi.fn<(state: WaitlistFormSuccessState) => void>();
    renderWith(answering({ status: "confirmation_sent" }), { onSuccess });
    await submit();
    expect(onSuccess).toHaveBeenCalledWith({ status: "confirmation_sent" });
  });

  it("does not call onSuccess for a refused sign-up", async () => {
    const onSuccess = vi.fn<(state: WaitlistFormSuccessState) => void>();
    renderWith(answering({ status: "error", error: "security.rate_limited" }), { onSuccess });
    await submit();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("shows the app's success node in place of the form and of the default notice", async () => {
    renderWith(answering({ status: "ok", unsubscribeUrl: "https://app.example.com/u" }), {
      success: <section aria-label="You are in">Thanks, see you at launch.</section>,
    });
    await submit();
    expect(screen.getByRole("region", { name: "You are in" }).textContent).toBe("Thanks, see you at launch.");
    expect(screen.queryByText(en.form.success)).toBeNull();
    expect(screen.queryByRole("link", { name: en.form.unsubscribeLink })).toBeNull();
    expect(screen.queryByRole("button", { name: en.form.submit })).toBeNull();
  });

  it("renders a success function with the sign-up's state", async () => {
    renderWith(answering({ status: "confirmation_sent" }), {
      success: (state) => <p>{state.status === "confirmation_sent" ? "Check your inbox." : "You are in."}</p>,
    });
    await submit();
    expect(screen.getByText("Check your inbox.")).toBeDefined();
  });

  it("lets onSuccess move focus to the app's view, which is already on the page", async () => {
    renderWith(answering({ status: "ok" }), {
      success: <h2 id="joined" tabIndex={-1}>You are on the list</h2>,
      onSuccess: () => document.getElementById("joined")?.focus(),
    });
    await submit();
    expect(document.activeElement?.textContent).toBe("You are on the list");
  });
});

describe("WaitlistForm in the app's look", () => {
  it("keeps today's full-width primary button by default", () => {
    renderForm(answering({ status: "idle" }));
    const button = screen.getByRole("button", { name: en.form.submit });
    expect(button.className).toContain("sft:w-full");
  });

  it("takes the button's width, variant and class", () => {
    render(
      <WaitlistForm
        action={answering({ status: "idle" })}
        scopes={SCOPES}
        placement="hero"
        messages={en}
        submitFullWidth={false}
        submitVariant="ink"
        classNames={{ submit: "app-button" }}
      />,
    );
    const button = screen.getByRole("button", { name: en.form.submit });
    expect(button.className).not.toContain("sft:w-full");
    expect(button.className).toContain("sft:bg-foreground");
    expect(button.className).toContain("app-button");
  });

  it("gives the email field a stable id, the app's placeholder and label class", () => {
    render(
      <WaitlistForm
        action={answering({ status: "idle" })}
        scopes={SCOPES}
        placement="hero"
        messages={en}
        emailProps={{ id: "field-email", placeholder: "you@example.com" }}
        fieldClassNames={{ label: "app-label" }}
      />,
    );
    const field = screen.getByLabelText(en.form.email);
    expect(field.id).toBe("field-email");
    expect(field.getAttribute("placeholder")).toBe("you@example.com");
    expect(document.querySelector(`label[for="field-email"]`)?.className).toContain("app-label");
  });

  it("renders a consent box at its id with its description and the app's box classes", () => {
    const scopes: WaitlistFormScope[] = [
      { id: "launch", label: "Tell me when it opens.", required: true, inputId: "field-consent-launch", description: "You can unsubscribe any time." },
      { id: "newsletter", label: "Send me the newsletter.", required: false },
    ];
    render(
      <WaitlistForm
        action={answering({ status: "idle" })}
        scopes={scopes}
        placement="hero"
        messages={en}
        scopeClassNames={{ label: "app-check" }}
      />,
    );
    const box = screen.getByRole("checkbox", { name: "Tell me when it opens." });
    expect(box.id).toBe("field-consent-launch");
    const describedBy = box.getAttribute("aria-describedby") ?? "";
    expect(document.getElementById(describedBy.split(" ")[0] ?? "")?.textContent).toBe("You can unsubscribe any time.");
    expect(screen.getByText("Tell me when it opens.").className).toContain("app-check");
    expect(screen.getByText("Send me the newsletter.").className).toContain("app-check");
    expect(screen.getByRole("checkbox", { name: "Send me the newsletter." }).getAttribute("aria-describedby")).toBeNull();
  });

  it("keeps the box's id after an answer remounts it", async () => {
    const scopes: WaitlistFormScope[] = [{ id: "launch", label: "Tell me when it opens.", required: true, inputId: "field-consent-launch" }];
    render(
      <WaitlistForm
        action={answering({ status: "error", error: "waitlist.email_invalid", field: "email", email: "ada", scopes: ["launch"] })}
        scopes={scopes}
        placement="hero"
        messages={en}
      />,
    );
    await submit();
    const box = screen.getByRole("checkbox", { name: "Tell me when it opens." });
    expect(box.id).toBe("field-consent-launch");
    expect(box).toHaveProperty("checked", true);
  });
});
