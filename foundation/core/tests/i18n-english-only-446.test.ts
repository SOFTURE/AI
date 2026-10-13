import { describe, expect, it } from "vitest";
import {
  coreMessages,
  DEFAULT_LOCALE,
  defineSoftureConfig,
  isLocale,
  mergeMessages,
  pickLocalizedText,
  selectMessages,
  SoftureConfigError,
} from "@softure-ai/core";

const defaults = { en: { login: { title: "Sign in", submit: "Continue" }, footer: "Bye" } };

describe("English as the only built-in language (#446)", () => {
  it("ships core's own copy in English only", () => {
    expect(DEFAULT_LOCALE).toBe("en");
    expect(Object.keys(coreMessages)).toEqual(["en"]);
  });

  it("accepts any well-formed BCP 47 tag as a locale", () => {
    expect(["en", "de", "de-AT", "pt-BR", "zh-Hant-TW"].filter(isLocale)).toHaveLength(5);
    expect(["", "not a tag", "en_US", undefined, 42].some(isLocale)).toBe(false);
  });

  it("lets the config name any locale and refuses one that is not a tag", () => {
    const base = { timezone: "UTC", appOrigin: "https://app.example.com", modules: [] };
    expect(defineSoftureConfig({ ...base, locale: "de-AT" }).locale).toBe("de-AT");
    expect(() => defineSoftureConfig({ ...base, locale: "en_US" })).toThrow(SoftureConfigError);
  });
});

describe("mergeMessages with an app's own translation", () => {
  it("builds a locale the defaults lack on English, so a key the translation leaves out reads English", () => {
    const merged = mergeMessages(defaults, { de: { login: { title: "Anmelden" } } });
    expect(merged.de).toEqual({ login: { title: "Anmelden", submit: "Continue" }, footer: "Bye" });
    expect(merged.en).toEqual(defaults.en);
  });

  it("keeps English unchanged and returns no other locale without overrides", () => {
    expect(mergeMessages(defaults)).toEqual(defaults);
  });
});

describe("selectMessages", () => {
  const dictionaries = mergeMessages(defaults, { de: { footer: "Tschuess" }, "de-AT": { footer: "Servus" } });

  it("takes the exact locale first", () => {
    expect(selectMessages(dictionaries, "de-AT").footer).toBe("Servus");
  });

  it("falls back to the locale's language", () => {
    expect(selectMessages(dictionaries, "de-CH").footer).toBe("Tschuess");
  });

  it("falls back to English for a locale the app did not translate", () => {
    expect(selectMessages(dictionaries, "fr").footer).toBe("Bye");
    expect(selectMessages(dictionaries, "fr-CA")).toBe(dictionaries.en);
  });
});

describe("pickLocalizedText", () => {
  const text = { en: "Monthly", de: "Monatlich" };

  it("picks the locale, then its language, then English", () => {
    expect(pickLocalizedText(text, "de")).toBe("Monatlich");
    expect(pickLocalizedText(text, "de-AT")).toBe("Monatlich");
    expect(pickLocalizedText(text, "fr")).toBe("Monthly");
  });

  it("returns the fallback when no locale has a text", () => {
    expect(pickLocalizedText(undefined, "en")).toBe("");
    expect(pickLocalizedText({}, "en", "billing.monthly")).toBe("billing.monthly");
  });
});
