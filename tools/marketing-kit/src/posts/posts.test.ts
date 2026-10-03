import { describe, expect, it } from "vitest";

import type { Film } from "../film.js";
import { getMarketingMessages } from "../messages/index.js";
import { buildPosts, postsMarkdown } from "./posts.js";

const film = {
  id: "test",
  title: "Anna counts her date",
  channels: { instagram: "ig-01", facebook: "fb-01", tiktok: "tiktok-01" },
  post: { caption: "When can you stop working?", hashtags: ["fire", "#finance"] },
} as unknown as Film;

const site = "https://example.com/calculator";
const en = { site, messages: getMarketingMessages("en") };
const pl = { site, messages: getMarketingMessages("pl") };

describe("buildPosts", () => {
  it("gives every platform its own channel code in the link", () => {
    expect(Object.fromEntries(buildPosts(film, en).map((post) => [post.platform, post.link]))).toEqual({
      instagram: "https://example.com/calculator?z=ig-01",
      facebook: "https://example.com/calculator?z=fb-01",
      tiktok: "https://example.com/calculator?z=tiktok-01",
    });
  });

  it("sends Instagram and TikTok to the bio and links in the text on Facebook", () => {
    const [instagram, facebook, tiktok] = buildPosts(film, en);
    expect(instagram?.text).toContain("Link in bio.");
    expect(tiktok?.text).toContain("Link in bio.");
    expect(facebook?.text).toContain("https://example.com/calculator?z=fb-01");
    expect(instagram?.text).not.toContain("?z=");
  });

  it("writes the call to action in the configured locale", () => {
    expect(buildPosts(film, pl)[0]?.text).toContain(pl.messages.posts.linkInBio);
  });

  it("gives hashtags a single # whatever the script wrote", () => {
    expect(buildPosts(film, en)[0]?.text).toBe("When can you stop working?\n\nLink in bio.\n\n#fire #finance");
  });

  it("leaves out empty parts instead of blank paragraphs", () => {
    const bare = { ...film, post: { caption: "", hashtags: [] } } as Film;
    expect(buildPosts(bare, en)[1]?.text).toBe("https://example.com/calculator?z=fb-01");
  });
});

describe("postsMarkdown", () => {
  it("has a section for every platform", () => {
    const markdown = postsMarkdown(film, en);
    expect(markdown).toContain("## Instagram (Reels)");
    expect(markdown).toContain("## Facebook (Reels / post)");
    expect(markdown).toContain("## TikTok");
  });

  it("titles the file and names where each link goes", () => {
    const markdown = postsMarkdown(film, en);
    expect(markdown.startsWith("# Anna counts her date: post copy\n")).toBe(true);
    expect(markdown).toContain("Link for the bio: https://example.com/calculator?z=ig-01");
    expect(markdown).toContain("Link in the post: https://example.com/calculator?z=fb-01");
  });
});
