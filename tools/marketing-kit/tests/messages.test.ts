import { describe, expect, it } from "vitest";

import { formatMessage, getMarketingMessages, marketingMessages } from "../src/messages/index.js";

describe("formatMessage", () => {
  it("replaces every placeholder with its value", () => {
    expect(formatMessage("{name}, {age}", { name: "Anna", age: 36 })).toBe("Anna, 36");
  });

  it("throws on a placeholder without a value, because the copy and the code disagree", () => {
    expect(() => formatMessage("{name}, {age}", { name: "Anna" })).toThrow(/\{age\}/);
  });
});

describe("marketing messages", () => {
  it("ship English as the only built-in language", () => {
    expect(Object.keys(marketingMessages)).toEqual(["en"]);
    expect(getMarketingMessages()).toEqual(marketingMessages.en);
  });

  it("apply overrides key by key, the English copy filling the rest, without changing the built-in copy", () => {
    const messages = getMarketingMessages({ posts: { linkInBio: "Link in der Bio.", platforms: { x: "X (Twitter)" } } });
    expect(messages.posts.linkInBio).toBe("Link in der Bio.");
    expect(messages.posts.platforms).toEqual({ ...marketingMessages.en.posts.platforms, x: "X (Twitter)" });
    expect(messages.posts.title).toBe(marketingMessages.en.posts.title);
    expect(messages.film).toEqual(marketingMessages.en.film);
    expect(marketingMessages.en.posts.linkInBio).toBe("Link in bio.");
  });
});
