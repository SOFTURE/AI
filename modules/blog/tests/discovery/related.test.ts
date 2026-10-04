// "Read next" (FIRE's cases). The input is newest first, the store's order.
import { getRelatedArticles } from "@softure-ai/blog/server";
import { describe, expect, it } from "vitest";
import { buildText, getIds } from "./support.js";

describe("getRelatedArticles", () => {
  const pillar = buildText("pillar", { isPillar: true });
  const s1 = buildText("s1");
  const s2 = buildText("s2");
  const s3 = buildText("s3");
  const s4 = buildText("s4");
  const s5 = buildText("s5");
  const s6 = buildText("s6");
  const s7 = buildText("s7");
  const otherPillar = buildText("other-pillar", { cluster: "taxes", isPillar: true });
  const other1 = buildText("other-1", { cluster: "taxes" });
  const loose = buildText("loose", { cluster: null });

  it("puts a satellite's pillar first, then its cluster, and never the article itself", () => {
    expect(getIds(getRelatedArticles(s3, [s1, s2, s3, pillar, s4, otherPillar]))).toEqual(["pillar", "s1", "s2", "s4"]);
  });

  it("fills a small cluster from the others, pillars first", () => {
    expect(getIds(getRelatedArticles(s1, [other1, s1, loose, pillar, otherPillar]))).toEqual(["pillar", "other-pillar", "other-1", "loose"]);
  });

  it("gives a pillar every satellite of its cluster, up to six, even above four", () => {
    expect(getIds(getRelatedArticles(pillar, [s1, s2, s3, pillar, s4, s5, s6, s7, otherPillar]))).toEqual(["s1", "s2", "s3", "s4", "s5", "s6"]);
  });

  it("fills a pillar with one satellite up to four from other clusters", () => {
    expect(getIds(getRelatedArticles(pillar, [loose, s1, pillar, other1, otherPillar]))).toEqual(["s1", "other-pillar", "loose", "other-1"]);
  });

  it("gives a text without a cluster the pillars, then the newest", () => {
    expect(getIds(getRelatedArticles(loose, [s1, loose, other1, pillar]))).toEqual(["pillar", "s1", "other-1"]);
  });

  it("is empty for the only text of the blog", () => {
    expect(getRelatedArticles(s1, [s1])).toEqual([]);
  });
});
