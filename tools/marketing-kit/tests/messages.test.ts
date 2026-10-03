import { describe, expect, it } from "vitest";

import { MARKETING_LOCALES, formatMessage, getMarketingMessages } from "../src/messages/index.js";

describe("formatMessage", () => {
  it("replaces every placeholder with its value", () => {
    expect(formatMessage("{name}, {age}", { name: "Anna", age: 36 })).toBe("Anna, 36");
  });

  it("throws on a placeholder without a value, because the copy and the code disagree", () => {
    expect(() => formatMessage("{name}, {age}", { name: "Anna" })).toThrow(/\{age\}/);
  });
});

describe("marketing messages", () => {
  it("offers English and Polish", () => {
    expect(MARKETING_LOCALES).toEqual(["en", "pl"]);
  });

  it("keeps the same placeholders in every locale", () => {
    const placeholders = (text: string) => [...text.matchAll(/\{([a-zA-Z]+)\}/g)].map((match) => match[1]).sort();
    const en = getMarketingMessages("en");
    const pl = getMarketingMessages("pl");
    expect(placeholders(pl.posts.title)).toEqual(placeholders(en.posts.title));
    expect(placeholders(pl.posts.bioLink)).toEqual(placeholders(en.posts.bioLink));
    expect(placeholders(pl.posts.postLink)).toEqual(placeholders(en.posts.postLink));
    expect(placeholders(pl.film.persona)).toEqual(placeholders(en.film.persona));
  });
});
