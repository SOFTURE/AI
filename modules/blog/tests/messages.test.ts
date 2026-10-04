import { describe, expect, it } from "vitest";
import { blogMessages } from "@softure-ai/blog";

describe("blog messages", () => {
  it("labels every kind and status in English and in translated Polish", () => {
    expect(blogMessages.en.kinds).toEqual({ article: "Article", term: "Glossary term" });
    expect(blogMessages.en.statuses).toEqual({ draft: "Draft", published: "Published", withdrawn: "Withdrawn" });
    expect(blogMessages.pl.kinds.article).not.toBe(blogMessages.en.kinds.article);
    expect(blogMessages.pl.statuses.withdrawn).not.toBe(blogMessages.en.statuses.withdrawn);
  });
});
