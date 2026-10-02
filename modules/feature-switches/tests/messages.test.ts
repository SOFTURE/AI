import { featureSwitchesMessages, getSwitchErrorMessage, type SwitchFormErrorCode } from "@softure-ai/feature-switches";
import { describe, expect, it } from "vitest";

const CODES: SwitchFormErrorCode[] = ["feature-switches.unknown_switch", "auth.forbidden", "core.database_failed", "core.unexpected"];

describe("feature-switches messages", () => {
  it.each(["en", "pl"] as const)("have copy in %s for every code the panel can show", (locale) => {
    for (const code of CODES) {
      const message = getSwitchErrorMessage(featureSwitchesMessages[locale], code);
      expect(message, code).not.toBe("");
      expect(message === featureSwitchesMessages[locale].errors.core.unexpected, code).toBe(code === "core.unexpected" || code === "core.database_failed");
    }
  });

  it("look up a code whose namespace has a dash", () => {
    expect(getSwitchErrorMessage(featureSwitchesMessages.en, "feature-switches.unknown_switch")).toBe(
      "This switch is no longer declared. Reload the page.",
    );
  });

  it("fall back to the generic failure for a code they do not know", () => {
    // @ts-expect-error: a code from a newer server than the dictionary.
    expect(getSwitchErrorMessage(featureSwitchesMessages.en, "feature-switches.something_new")).toBe(featureSwitchesMessages.en.errors.core.unexpected);
    // @ts-expect-error: an inherited property is not a message.
    expect(getSwitchErrorMessage(featureSwitchesMessages.en, "auth.toString")).toBe(featureSwitchesMessages.en.errors.core.unexpected);
  });

  it("are translated, not copied", () => {
    expect(featureSwitchesMessages.pl.panel.title).not.toBe(featureSwitchesMessages.en.panel.title);
  });
});
