// The addresses a publish run changed (FIRE's cases), on the module's routes.
import { getIndexNowPaths, type IndexNowChange } from "@softure-ai/blog/server";
import { describe, expect, it } from "vitest";
import { ROUTES } from "./support.js";

function buildChange(overrides: Partial<IndexNowChange> = {}): IndexNowChange {
  return { kind: "article", action: "added", statusBefore: null, statusAfter: "published", slug: "index-funds", previousSlug: null, ...overrides };
}

describe("getIndexNowPaths", () => {
  it("submits a new published article and the listing", () => {
    expect(getIndexNowPaths([buildChange()], ROUTES)).toEqual(["/blog/index-funds", "/blog"]);
  });

  it("submits nothing for an unchanged text, not even the listing", () => {
    expect(getIndexNowPaths([buildChange({ action: "unchanged", statusBefore: "published" })], ROUTES)).toEqual([]);
  });

  it("submits nothing for a draft that stays a draft", () => {
    expect(getIndexNowPaths([buildChange({ statusAfter: "draft" })], ROUTES)).toEqual([]);
  });

  it("submits a withdrawn text (now 410) and the listing", () => {
    expect(getIndexNowPaths([buildChange({ action: "changed", statusBefore: "published", statusAfter: "withdrawn" })], ROUTES)).toEqual(["/blog/index-funds", "/blog"]);
  });

  it("submits the new address, the old one (now 301) and the listing after a rename", () => {
    expect(getIndexNowPaths([buildChange({ action: "changed", statusBefore: "published", slug: "funds", previousSlug: "index-funds" })], ROUTES)).toEqual([
      "/blog/funds",
      "/blog/index-funds",
      "/blog",
    ]);
  });

  it("skips the old address of a text that was not public before", () => {
    expect(getIndexNowPaths([buildChange({ action: "changed", statusBefore: "draft", slug: "funds", previousSlug: "index-funds" })], ROUTES)).toEqual([
      "/blog/funds",
      "/blog",
    ]);
  });

  it("submits a term under the glossary with the glossary's hub", () => {
    expect(getIndexNowPaths([buildChange({ kind: "term", slug: "etf" })], ROUTES)).toEqual(["/blog/glossary/etf", "/blog/glossary"]);
  });

  it("lists the texts first, then each hub once", () => {
    expect(getIndexNowPaths([buildChange(), buildChange({ kind: "term", slug: "etf" }), buildChange({ slug: "bonds" })], ROUTES)).toEqual([
      "/blog/index-funds",
      "/blog/glossary/etf",
      "/blog/bonds",
      "/blog",
      "/blog/glossary",
    ]);
  });
});
