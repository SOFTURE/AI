import { describe, expect, it } from "vitest";
import {
  coreMessages,
  formatMessage,
  getMessage,
  isLocale,
  LOCALES,
  mergeMessages,
  selectPlural,
  type CoreErrorCode,
} from "@softure-ai/core";

const defaults = {
  en: { login: { title: "Sign in", submit: "Continue" }, footer: "Bye" },
  pl: { login: { title: coreMessages.pl.errors.unexpected, submit: coreMessages.pl.errors.database_failed }, footer: "Pa" },
};

describe("locales", () => {
  it("ship English and Polish", () => {
    expect(LOCALES).toEqual(["en", "pl"]);
  });

  it("recognise only shipped locales", () => {
    expect(isLocale("pl")).toBe(true);
    expect(isLocale("de")).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });
});

describe("mergeMessages", () => {
  it("returns equal dictionaries when there are no overrides", () => {
    expect(mergeMessages(defaults)).toEqual(defaults);
  });

  it("replaces only the overridden leaves of one locale", () => {
    const merged = mergeMessages(defaults, { en: { login: { title: "Sign in to Acme" } } });
    expect(merged.en).toEqual({ login: { title: "Sign in to Acme", submit: "Continue" }, footer: "Bye" });
    expect(merged.pl).toEqual(defaults.pl);
  });

  it("ignores keys the defaults do not have", () => {
    const overrides = { en: { unknown: "x", login: { other: "y" } } } as never;
    expect(mergeMessages(defaults, overrides)).toEqual(defaults);
  });

  it("ignores an override that replaces a group with a string", () => {
    const overrides = { en: { login: "flat" } } as never;
    expect(mergeMessages(defaults, overrides)).toEqual(defaults);
  });

  it("does not mutate its inputs", () => {
    const overrides = { en: { footer: "See you" } };
    const before = structuredClone(defaults);
    mergeMessages(defaults, overrides);
    expect(defaults).toEqual(before);
    expect(overrides).toEqual({ en: { footer: "See you" } });
  });
});

describe("formatMessage", () => {
  it("fills named placeholders", () => {
    expect(formatMessage("{count} of {total} done", { count: 3, total: 5 })).toBe("3 of 5 done");
  });

  it("leaves a placeholder without a value as written", () => {
    expect(formatMessage("Hello {name}", {})).toBe("Hello {name}");
  });

  it("returns the template unchanged without params", () => {
    expect(formatMessage("Plain {text}")).toBe("Plain {text}");
  });
});

describe("selectPlural", () => {
  const forms = { one: "one", few: "few", many: "many", other: "other" };

  it.each([
    [0, "many"],
    [1, "one"],
    [2, "few"],
    [4, "few"],
    [5, "many"],
    [12, "many"],
    [22, "few"],
    [25, "many"],
  ])("picks the Polish form for %i", (count, expected) => {
    expect(selectPlural("pl", count, forms)).toBe(expected);
  });

  it.each([
    [0, "other"],
    [1, "one"],
    [2, "other"],
  ])("picks the English form for %i", (count, expected) => {
    expect(selectPlural("en", count, forms)).toBe(expected);
  });

  it("falls back to other when a form is missing", () => {
    expect(selectPlural("pl", 3, { one: "one", other: "other" })).toBe("other");
  });
});

describe("getMessage", () => {
  it("finds a nested message by its dotted path", () => {
    expect(getMessage(defaults.en, "login.title")).toBe("Sign in");
  });

  it("returns undefined for a missing path or a group", () => {
    expect(getMessage(defaults.en, "login.missing")).toBeUndefined();
    expect(getMessage(defaults.en, "login")).toBeUndefined();
    expect(getMessage(defaults.en, "")).toBeUndefined();
  });
});

describe("core messages", () => {
  const codes: CoreErrorCode[] = ["core.database_failed", "core.unexpected"];

  it.each(LOCALES)("translate every core error code in %s", (locale) => {
    for (const code of codes) {
      const message = getMessage(coreMessages[locale], `errors.${code.replace("core.", "")}`);
      expect(message, code).toMatch(/\S/);
    }
  });

  it("are translated, not copied", () => {
    expect(coreMessages.pl.errors.unexpected).not.toBe(coreMessages.en.errors.unexpected);
  });
});
