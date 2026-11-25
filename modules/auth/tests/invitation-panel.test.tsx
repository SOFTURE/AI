// @vitest-environment happy-dom
import { authMessages, type AuthFormState } from "@softure-ai/auth";
import { InvitationPanel, type InvitationPanelRow } from "@softure-ai/auth/ui";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const en = authMessages.en;
const EMAIL = "grace@example.com";

type Action = (state: AuthFormState, formData: FormData) => Promise<AuthFormState>;

function createRow(overrides: Partial<InvitationPanelRow> = {}): InvitationPanelRow {
  return { id: "inv-1", email: EMAIL, title: `${EMAIL}: Pending`, details: [], isOpen: true, ...overrides };
}

function renderPanel(options: { row?: InvitationPanelRow; revoke?: Action; resend?: Action } = {}) {
  const idle: Action = () => Promise.resolve({ status: "idle" });
  const revokeAction = vi.fn<Action>(options.revoke ?? idle);
  const resendAction = vi.fn<Action>(options.resend ?? idle);
  render(
    <InvitationPanel
      rows={[options.row ?? createRow()]}
      roles={[]}
      inviteAction={idle}
      resendAction={resendAction}
      revokeAction={revokeAction}
      messages={en}
    />,
  );
  return { revokeAction, resendAction };
}

async function click(element: HTMLElement): Promise<void> {
  await act(async () => {
    fireEvent.click(element);
    await new Promise((resolve) => setTimeout(resolve));
  });
}

function getRevokeTrigger(): HTMLElement {
  return screen.getByRole("button", { name: en.invitations.revoke });
}

describe("InvitationPanel revoke", () => {
  it("asks in a dialog named after the email before it revokes", async () => {
    const { revokeAction } = renderPanel();
    await click(getRevokeTrigger());
    const dialog = screen.getByRole("dialog", { name: `Revoke the invitation for ${EMAIL}?` });
    expect(dialog.textContent).toContain(en.invitations.revokeBody);
    expect(revokeAction).not.toHaveBeenCalled();
  });

  it("keeps the invitation on Cancel and returns focus to Revoke", async () => {
    const { revokeAction } = renderPanel();
    const trigger = getRevokeTrigger();
    trigger.focus();
    await click(trigger);
    await click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(revokeAction).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(trigger);
  });

  it("revokes the row's invitation once on confirm and closes the dialog", async () => {
    const { revokeAction } = renderPanel();
    await click(getRevokeTrigger());
    const dialog = screen.getByRole("dialog");
    const confirm = Array.from(dialog.querySelectorAll("button")).find((button) => button.textContent === en.invitations.revokeConfirm);
    if (confirm === undefined) throw new Error("the dialog has no confirm button");
    await click(confirm);
    expect(revokeAction).toHaveBeenCalledTimes(1);
    const formData = revokeAction.mock.calls[0]?.[1];
    expect(formData?.get("id")).toBe("inv-1");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("names no email when the row has none", async () => {
    renderPanel({ row: createRow({ email: undefined }) });
    await click(getRevokeTrigger());
    expect(screen.getByRole("dialog", { name: en.invitations.revokeTitleUnnamed })).not.toBeNull();
  });

  it("resends at once, without a dialog", async () => {
    const { resendAction } = renderPanel();
    await click(screen.getByRole("button", { name: en.invitations.resend }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(resendAction).toHaveBeenCalledTimes(1);
  });

  it("reads the English dialog copy when the app's dictionary predates it", async () => {
    const LATER_KEYS = new Set(["revokeTitle", "revokeTitleUnnamed", "revokeBody", "revokeConfirm"]);
    const older = Object.fromEntries(Object.entries(en.invitations).filter(([key]) => !LATER_KEYS.has(key))) as Omit<
      typeof en.invitations,
      "revokeTitle" | "revokeTitleUnnamed" | "revokeBody" | "revokeConfirm"
    >;
    const idle: Action = () => Promise.resolve({ status: "idle" });
    render(
      <InvitationPanel
        rows={[createRow()]}
        roles={[]}
        inviteAction={idle}
        resendAction={idle}
        revokeAction={idle}
        messages={{ ...en, invitations: older }}
      />,
    );
    await click(getRevokeTrigger());
    expect(screen.getByRole("dialog", { name: `Revoke the invitation for ${EMAIL}?` })).not.toBeNull();
  });
});
