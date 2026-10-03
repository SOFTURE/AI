import { describe, expect, it } from "vitest";

import { getMarketingMessages } from "../messages/index.js";
import { buildPosts, postsMarkdown, type PostsInput } from "./posts.js";

const input: PostsInput = {
  title: "Anna counts her date",
  post: {
    caption: "When can you stop working?",
    hashtags: ["fire", "#finance"],
    channels: [
      { platform: "instagram", code: "ig-01", linkInBio: true },
      { platform: "facebook", code: "fb-01", linkInBio: false },
      { platform: "tiktok", code: "tiktok-01", linkInBio: true },
    ],
  },
  linkTemplate: "https://example.com/calculator?z={code}",
  messages: getMarketingMessages("en"),
};
const pl: PostsInput = { ...input, messages: getMarketingMessages("pl") };

describe("buildPosts", () => {
  it("gives every platform its own channel code in the link", () => {
    expect(Object.fromEntries(buildPosts(input).map((post) => [post.platform, post.link]))).toEqual({
      instagram: "https://example.com/calculator?z=ig-01",
      facebook: "https://example.com/calculator?z=fb-01",
      tiktok: "https://example.com/calculator?z=tiktok-01",
    });
  });

  it("puts the code wherever the template says", () => {
    const posts = buildPosts({ ...input, linkTemplate: "https://example.com/go/{code}?from=film" });
    expect(posts[0]?.link).toBe("https://example.com/go/ig-01?from=film");
  });

  it("sends a link-in-bio platform to the bio and links in the text elsewhere", () => {
    const [instagram, facebook, tiktok] = buildPosts(input);
    expect(instagram?.text).toContain("Link in bio.");
    expect(tiktok?.text).toContain("Link in bio.");
    expect(facebook?.text).toContain("https://example.com/calculator?z=fb-01");
    expect(instagram?.text).not.toContain("?z=");
  });

  it("writes only the configured platforms, in their order", () => {
    const post = { ...input.post, channels: [{ platform: "linkedin" as const, code: "li-01", linkInBio: false }] };
    expect(buildPosts({ ...input, post }).map((entry) => [entry.label, entry.text])).toEqual([
      ["LinkedIn", "When can you stop working?\n\nhttps://example.com/calculator?z=li-01\n\n#fire #finance"],
    ]);
  });

  it("writes the call to action in the configured locale", () => {
    expect(buildPosts(pl)[0]?.text).toContain(pl.messages.posts.linkInBio);
  });

  it("gives hashtags a single # whatever the script wrote", () => {
    expect(buildPosts(input)[0]?.text).toBe("When can you stop working?\n\nLink in bio.\n\n#fire #finance");
  });

  it("leaves out empty parts instead of blank paragraphs", () => {
    const bare = { ...input, post: { ...input.post, caption: "", hashtags: [] } };
    expect(buildPosts(bare)[1]?.text).toBe("https://example.com/calculator?z=fb-01");
  });
});

describe("postsMarkdown", () => {
  it("has a section for every platform", () => {
    const markdown = postsMarkdown(input);
    expect(markdown).toContain("## Instagram (Reels)");
    expect(markdown).toContain("## Facebook (Reels / post)");
    expect(markdown).toContain("## TikTok");
  });

  it("titles the file and names where each link goes", () => {
    const markdown = postsMarkdown(input);
    expect(markdown.startsWith("# Anna counts her date: post copy\n")).toBe(true);
    expect(markdown).toContain("Link for the bio: https://example.com/calculator?z=ig-01");
    expect(markdown).toContain("Link in the post: https://example.com/calculator?z=fb-01");
  });
});
