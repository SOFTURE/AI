import { describe, expect, it } from "vitest";
import { blogMessages } from "@softure-ai/blog";

describe("blog messages", () => {
  it("labels every kind and status in English", () => {
    expect(blogMessages.en.kinds).toEqual({ article: "Article", term: "Glossary term" });
    expect(blogMessages.en.statuses).toEqual({ draft: "Draft", published: "Published", withdrawn: "Withdrawn" });
  });

  it("ship English as the only built-in language", () => {
    expect(Object.keys(blogMessages)).toEqual(["en"]);
  });
});
