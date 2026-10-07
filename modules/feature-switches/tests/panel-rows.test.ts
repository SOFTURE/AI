// The panel's row mapping, exported so an app can build the panel inside its own page shell.
import { featureSwitchesMessages, type SwitchView } from "@softure-ai/feature-switches";
import { describeSwitchSource, toSwitchPanelRows } from "@softure-ai/feature-switches/next";
import { describe, expect, it } from "vitest";

const CONFIG = { locale: "en", timezone: "Europe/Warsaw" } as const;
const MESSAGES = featureSwitchesMessages.en;

function createView(overrides: Partial<SwitchView> = {}): SwitchView {
  return {
    name: "billing.checkout_enabled",
    label: "Checkout",
    description: "Lets users pay.",
    isEnabled: false,
    source: "default",
    envName: "SOFTURE_SWITCH_BILLING_CHECKOUT_ENABLED",
    updatedAt: null,
    updatedBy: null,
    ...overrides,
  };
}

describe("describeSwitchSource", () => {
  it("names the environment variable that holds the switch", () => {
    expect(describeSwitchSource(createView({ source: "env" }), MESSAGES, CONFIG)).toBe(
      "Set by the environment variable SOFTURE_SWITCH_BILLING_CHECKOUT_ENABLED. Change it there.",
    );
  });

  it("dates a stored value in the configured locale and time zone", () => {
    const view = createView({ source: "stored", updatedAt: new Date("2026-09-15T22:30:00Z") });
    expect(describeSwitchSource(view, MESSAGES, CONFIG)).toBe("Changed on Sep 16, 2026, 12:30 AM.");
    expect(describeSwitchSource(view, MESSAGES, { locale: "en", timezone: "UTC" })).toBe("Changed on Sep 15, 2026, 10:30 PM.");
  });

  it("leaves the date empty for a stored value without one", () => {
    expect(describeSwitchSource(createView({ source: "stored" }), MESSAGES, CONFIG)).toBe("Changed on .");
  });

  it("describes the default and the fail mode", () => {
    expect(describeSwitchSource(createView(), MESSAGES, CONFIG)).toBe("Default value; never changed.");
    expect(describeSwitchSource(createView({ source: "fail-mode" }), MESSAGES, CONFIG)).toBe(
      "The stored value could not be read, so the switch shows its fail-safe value.",
    );
  });
});

describe("toSwitchPanelRows", () => {
  it("maps each view to a panel row and locks only the ones held by the environment", () => {
    const views = [createView({ isEnabled: true, source: "env" }), createView({ name: "app.beta_banner", label: "app.beta_banner", description: null })];
    expect(toSwitchPanelRows(views, MESSAGES, CONFIG)).toEqual([
      {
        name: "billing.checkout_enabled",
        label: "Checkout",
        description: "Lets users pay.",
        isEnabled: true,
        isLocked: true,
        note: "Set by the environment variable SOFTURE_SWITCH_BILLING_CHECKOUT_ENABLED. Change it there.",
      },
      { name: "app.beta_banner", label: "app.beta_banner", description: null, isEnabled: false, isLocked: false, note: "Default value; never changed." },
    ]);
  });

  it("returns no rows for no switches", () => {
    expect(toSwitchPanelRows([], MESSAGES, CONFIG)).toEqual([]);
  });
});

