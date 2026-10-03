// @vitest-environment happy-dom
import { featureSwitchesMessages, type SwitchFormState } from "@softure-ai/feature-switches";
import { SwitchPanel, type SwitchPanelAction, type SwitchPanelRow } from "@softure-ai/feature-switches/ui";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(cleanup);

const en = featureSwitchesMessages.en;

const CHECKOUT: SwitchPanelRow = {
  name: "billing.checkout_enabled",
  label: "Checkout",
  description: "Lets users pay.",
  isEnabled: false,
  isLocked: false,
  note: "Default value; never changed.",
};

function answering(state: Omit<SwitchFormState, "isEnabled"> & { isEnabled?: boolean }) {
  return vi.fn<SwitchPanelAction>((previous, formData) =>
    Promise.resolve({ ...state, isEnabled: state.isEnabled ?? formData.get("enabled") !== null } as SwitchFormState),
  );
}

async function toggle(name: string): Promise<void> {
  await act(async () => {
    fireEvent.click(screen.getByRole("switch", { name }));
    await Promise.resolve();
  });
}

describe("SwitchPanel", () => {
  it("lists each switch as a labelled switch with its description and where its value comes from", () => {
    render(<SwitchPanel switches={[CHECKOUT, { ...CHECKOUT, name: "app.beta", label: "Beta", isEnabled: true }]} action={answering({ status: "ok" })} messages={en} />);
    expect(screen.getByRole("switch", { name: "Checkout" })).toHaveProperty("checked", false);
    expect(screen.getByRole("switch", { name: "Beta" })).toHaveProperty("checked", true);
    expect(screen.getAllByText("Lets users pay.")).toHaveLength(2);
    expect(screen.getAllByText(CHECKOUT.note)).toHaveLength(2);
  });

  it("saves on change, sending the switch name and its new value", async () => {
    const action = answering({ status: "ok" });
    render(<SwitchPanel switches={[CHECKOUT]} action={action} messages={en} />);
    await toggle("Checkout");
    expect(action).toHaveBeenCalledTimes(1);
    const formData = action.mock.calls[0]?.[1];
    expect([formData?.get("name"), formData?.get("enabled")]).toEqual(["billing.checkout_enabled", "on"]);
    expect(screen.getByRole("switch", { name: "Checkout" })).toHaveProperty("checked", true);
  });

  it("puts the old value back and shows the error when the save is refused", async () => {
    render(<SwitchPanel switches={[CHECKOUT]} action={answering({ status: "error", error: "auth.forbidden", isEnabled: false })} messages={en} />);
    await toggle("Checkout");
    expect(screen.getByRole("switch", { name: "Checkout" })).toHaveProperty("checked", false);
    expect(screen.getByRole("alert").textContent).toBe(en.errors.auth.forbidden);
  });

  it("disables a switch held by its environment override", () => {
    render(<SwitchPanel switches={[{ ...CHECKOUT, isLocked: true }]} action={answering({ status: "ok" })} messages={en} />);
    expect(screen.getByRole("switch", { name: "Checkout" })).toHaveProperty("disabled", true);
  });

  it("says so when the app declares no switches", () => {
    render(<SwitchPanel switches={[]} action={answering({ status: "ok" })} messages={en} />);
    expect(screen.getByText(en.panel.empty)).toBeDefined();
    expect(screen.queryByRole("switch")).toBeNull();
  });

  it("reports the switches modules read that the app does not define, under the switches", () => {
    render(
      <SwitchPanel
        switches={[CHECKOUT]}
        undefinedSwitches={[{ name: "auth.registration_closed", moduleId: "auth" }]}
        action={answering({ status: "ok" })}
        messages={en}
      />,
    );
    const report = screen.getByRole("region", { name: en.panel.undefinedTitle });
    expect(report.textContent).toBe(
      `${en.panel.undefinedTitle}auth.registration_closed (module auth) uses the module's own default. Define it in the app's switches to change it here.`,
    );
  });

  it("shows no report when every switch modules read is defined", () => {
    render(<SwitchPanel switches={[CHECKOUT]} undefinedSwitches={[]} action={answering({ status: "ok" })} messages={en} />);
    expect(screen.queryByRole("region")).toBeNull();
  });
});
