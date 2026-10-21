// @vitest-environment happy-dom
import { connectionsMessages, type ConnectionFormState } from "@softure-ai/connections";
import { ConnectionsPanel, type ConnectionPanelAction, type ConnectionPanelRow } from "@softure-ai/connections/ui";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(cleanup);

const en = connectionsMessages.en;

const GOOGLE: ConnectionPanelRow = {
  provider: "google",
  accountId: "default",
  kind: "oauth",
  label: "Google",
  status: "not_connected",
  statusLabel: "Not connected",
  details: [],
  lastError: null,
  hint: null,
};

const RAINDROP: ConnectionPanelRow = { ...GOOGLE, provider: "raindrop", kind: "api_key", label: "Raindrop", hint: "Settings, Integrations." };

function answering(state: ConnectionFormState) {
  return vi.fn<ConnectionPanelAction>(() => Promise.resolve(state));
}

function actions(overrides: Partial<Record<"start" | "save" | "disconnect", ConnectionPanelAction>> = {}) {
  return { start: answering({ status: "ok" }), save: answering({ status: "ok" }), disconnect: answering({ status: "ok" }), ...overrides };
}

async function submit(button: HTMLElement): Promise<void> {
  await act(async () => {
    fireEvent.click(button);
    await Promise.resolve();
  });
}

describe("ConnectionsPanel", () => {
  it("shows each account's status, details and its connect button; no disconnect before it is connected", () => {
    render(<ConnectionsPanel rows={[GOOGLE, { ...RAINDROP, status: "connected", statusLabel: "Connected", details: ["Connected on Oct 21"] }]} actions={actions()} messages={en} />);
    expect(screen.getByText("Google")).toBeTruthy();
    expect(screen.getByText("Not connected")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Connect" })).toBeTruthy();
    expect(screen.getByText("Connected on Oct 21")).toBeTruthy();
    expect(screen.getByText("Settings, Integrations.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Replace" })).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Disconnect" })).toHaveLength(1);
  });

  it("offers a reconnect for an account that needs one", () => {
    render(<ConnectionsPanel rows={[{ ...GOOGLE, status: "reconnect_required", statusLabel: "Needs reconnect", lastError: "Last problem" }]} actions={actions()} messages={en} />);
    expect(screen.getByRole("button", { name: "Reconnect" })).toBeTruthy();
    expect(screen.getByText("Last problem")).toBeTruthy();
  });

  it("posts the provider and account to the start action and shows its refusal", async () => {
    const start = answering({ status: "error", error: "connections.provider_not_configured" });
    render(<ConnectionsPanel rows={[{ ...GOOGLE, accountId: "work" }]} actions={actions({ start })} messages={en} />);
    await submit(screen.getByRole("button", { name: "Connect" }));
    const form = start.mock.calls[0]?.[1];
    expect([form?.get("provider"), form?.get("account")]).toEqual(["google", "work"]);
    expect(screen.getByRole("alert").textContent).toBe(en.errors.connections.provider_not_configured);
  });

  it("posts a pasted key with its kind and never shows it back", async () => {
    const save = answering({ status: "ok" });
    render(<ConnectionsPanel rows={[RAINDROP]} actions={actions({ save })} messages={en} />);
    const input = screen.getByLabelText("API key");
    expect(input.getAttribute("type")).toBe("password");
    fireEvent.change(input, { target: { value: "rd-key" } });
    await submit(screen.getByRole("button", { name: "Save" }));
    const form = save.mock.calls[0]?.[1];
    expect([form?.get("provider"), form?.get("kind"), form?.get("apiKey")]).toEqual(["raindrop", "api_key", "rd-key"]);
  });

  it("asks a Basic provider for a username and password", () => {
    render(<ConnectionsPanel rows={[{ ...RAINDROP, kind: "basic" }]} actions={actions()} messages={en} />);
    expect(screen.getByLabelText("Username")).toBeTruthy();
    expect(screen.getByLabelText("Password").getAttribute("type")).toBe("password");
  });

  it("shows the callback's notice and the empty state", () => {
    render(<ConnectionsPanel rows={[]} notice={{ tone: "success", text: "Google is connected." }} actions={actions()} messages={en} />);
    expect(screen.getByRole("status").textContent).toBe("Google is connected.");
    expect(screen.getByText(en.page.empty)).toBeTruthy();
    cleanup();
    render(<ConnectionsPanel rows={[]} notice={{ tone: "error", text: "Access was not granted." }} actions={actions()} messages={en} />);
    expect(screen.getByRole("alert").textContent).toBe("Access was not granted.");
  });
});
