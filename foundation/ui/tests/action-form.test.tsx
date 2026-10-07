// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ActionForm,
  CheckboxField,
  type ActionResult,
  getAnnouncedToast,
  getSubmitLabel,
  MoneyField,
  TextField,
  uiMessages,
} from "../src/index.js";

afterEach(cleanup);

const MESSAGES: Readonly<Record<string, string>> = {
  "app.save_failed": "Could not save.",
  "app.name_taken": "This name is taken.",
};

function getErrorMessage(code: string): string {
  return MESSAGES[code] ?? code;
}

const accept = (): Promise<ActionResult> => Promise.resolve({ ok: true, value: undefined });

describe("ActionForm layout", () => {
  it("on a page: the submit button inside the form, no modal parts and no Cancel", () => {
    const html = renderToStaticMarkup(
      <ActionForm action={accept} getErrorMessage={getErrorMessage} submitLabel="Save">
        <TextField id="n" name="name" label="Name" />
      </ActionForm>,
    );
    expect(html).toMatch(/^<form class="sft:[^"]*"/);
    // React appends its form-replay script after the form when it renders an action.
    expect(html).toMatch(/<button type="submit"[^>]*><span data-reserve="Saving…"[^>]*><span>Save<\/span><\/span><\/button><\/div><\/form>/);
    expect(html).not.toContain("data-modal-part");
    expect(html).not.toContain(uiMessages.en.modal.cancel);
  });

  it("in a modal: fields in the body, submit in the footer next to Cancel, one form around both", () => {
    const html = renderToStaticMarkup(
      <ActionForm action={accept} getErrorMessage={getErrorMessage} submitLabel="Save" onCancel={() => undefined}>
        <TextField id="n" name="name" label="Name" />
      </ActionForm>,
    );
    expect(html.match(/<form /g)).toHaveLength(1);
    expect(html).toMatch(/^<form class="sft:contents"[^>]*><div data-modal-part="body"[^>]*>.*<input[^>]*name="name"/);
    expect(html).toMatch(/data-modal-part="footer".*>Cancel<\/button><button type="submit"[^>]*><span data-reserve="Saving…"[^>]*><span>Save<\/span><\/span><\/button>/);
  });
});

describe("getSubmitLabel", () => {
  it("shows the pending label only while a submit runs", () => {
    expect(getSubmitLabel({ isPending: true, submitLabel: "Save", pendingLabel: "Saving…" })).toBe("Saving…");
    expect(getSubmitLabel({ isPending: false, submitLabel: "Save", pendingLabel: "Saving…" })).toBe("Save");
  });
});

describe("ActionForm submit", () => {
  async function submit(form: HTMLFormElement) {
    await act(async () => {
      fireEvent.submit(form);
      await Promise.resolve();
    });
  }

  it("after a rejected submit shows the form error and field errors and replays what was typed", async () => {
    const action = vi.fn(
      (): Promise<ActionResult> => Promise.resolve({ ok: false, error: "app.save_failed", fieldErrors: { name: "app.name_taken" } }),
    );
    const { container } = render(
      <ActionForm action={action} getErrorMessage={getErrorMessage} submitLabel="Save">
        <TextField id="n" name="name" label="Name" defaultValue="Old" />
        <MoneyField id="m" name="amount" label="Amount" locale="pl" />
      </ActionForm>,
    );
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Taken" } });
    fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "1200" } });
    const form = container.querySelector("form");
    if (form === null) throw new Error("ActionForm rendered no form");
    await submit(form);
    expect(action).toHaveBeenCalledOnce();
    expect(screen.getByRole("alert").textContent).toBe("Could not save.");
    const name = screen.getByLabelText<HTMLInputElement>("Name");
    expect(name.value).toBe("Taken");
    expect(name.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByText("This name is taken.").id).toBe(name.getAttribute("aria-describedby"));
    expect(screen.getByLabelText<HTMLInputElement>("Amount").value).toBe("1 200,00");
  });

  it("turns a rejected action into a form error and keeps what was typed", async () => {
    const report = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const failure = new TypeError("Failed to fetch");
    const { container } = render(
      <ActionForm action={() => Promise.reject(failure)} getErrorMessage={getErrorMessage} submitLabel="Save">
        <TextField id="n" name="name" label="Name" />
      </ActionForm>,
    );
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Typed" } });
    const form = container.querySelector("form");
    if (form === null) throw new Error("ActionForm rendered no form");
    await submit(form);
    expect(screen.getByRole("alert").textContent).toBe(uiMessages.en.actionForm.failed);
    expect(screen.getByLabelText<HTMLInputElement>("Name").value).toBe("Typed");
    expect(report).toHaveBeenCalledWith("ActionForm: the action rejected", failure);
    report.mockRestore();
  });

  it("replays switches all turned off as off, not as their defaults", async () => {
    const reject = (): Promise<ActionResult> => Promise.resolve({ ok: false, error: "app.save_failed" });
    const { container } = render(
      <ActionForm action={reject} getErrorMessage={getErrorMessage} submitLabel="Save">
        <CheckboxField id="e" name="email" label="Email" defaultChecked />
        <CheckboxField id="p" name="push" label="Push" defaultChecked />
      </ActionForm>,
    );
    fireEvent.click(screen.getByLabelText("Email"));
    fireEvent.click(screen.getByLabelText("Push"));
    const form = container.querySelector("form");
    if (form === null) throw new Error("ActionForm rendered no form");
    await submit(form);
    expect(screen.getByLabelText<HTMLInputElement>("Email").checked).toBe(false);
    expect(screen.getByLabelText<HTMLInputElement>("Push").checked).toBe(false);
  });

  it("after a successful submit announces the toast, calls onSuccess and shows no error", async () => {
    const onSuccess = vi.fn();
    const { container } = render(
      <ActionForm action={accept} getErrorMessage={getErrorMessage} submitLabel="Save" successMessage="Saved" onSuccess={onSuccess}>
        <TextField id="n" name="name" label="Name" />
      </ActionForm>,
    );
    const before = getAnnouncedToast()?.token ?? 0;
    const form = container.querySelector("form");
    if (form === null) throw new Error("ActionForm rendered no form");
    await submit(form);
    expect(onSuccess).toHaveBeenCalledOnce();
    expect(getAnnouncedToast()).toEqual({ message: "Saved", token: before + 1 });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("reports a running save and its end", async () => {
    let finish: (result: ActionResult) => void = () => undefined;
    const action = () =>
      new Promise<ActionResult>((resolve) => {
        finish = resolve;
      });
    const onPendingChange = vi.fn();
    const { container } = render(
      <ActionForm action={action} getErrorMessage={getErrorMessage} submitLabel="Save" onPendingChange={onPendingChange}>
        <TextField id="n" name="name" label="Name" />
      </ActionForm>,
    );
    const form = container.querySelector("form");
    if (form === null) throw new Error("ActionForm rendered no form");
    await submit(form);
    expect(onPendingChange).toHaveBeenLastCalledWith(true);
    const button = screen.getByRole<HTMLButtonElement>("button", { name: uiMessages.en.actionForm.pending });
    expect(button.disabled).toBe(true);
    await act(async () => {
      finish({ ok: true, value: undefined });
      await Promise.resolve();
    });
    expect(onPendingChange).toHaveBeenLastCalledWith(false);
    expect(screen.getByRole("button", { name: "Save" })).toBeDefined();
  });
});
