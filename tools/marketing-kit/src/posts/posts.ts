import type { VideoPost } from "../config/config.js";
import { formatMessage, type MarketingMessages } from "../messages/index.js";
import { channelLink, type Platform } from "../platforms.js";

/**
 * Post copy for a film: one `posts.md` with ready text for every configured platform and a link
 * carrying the platform's channel code, so a visit from the film can be counted. The text is the
 * caption, the disclosure (`social.disclosure`), the link or the link-in-bio line, and the hashtags.
 *
 * Where a link in the caption is not clickable (Instagram, TikTok by default) the link goes to the
 * bio and the caption says so; elsewhere it is in the post.
 */

export interface PostsInput {
  /** The film's title, the heading of `posts.md`. */
  title: string;
  post: VideoPost;
  /** `social.linkTemplate`: the link with `{code}` where the channel code goes. */
  linkTemplate: string;
  messages: MarketingMessages;
}

export interface PlatformPost {
  platform: Platform;
  label: string;
  /** Text to paste under the film. */
  text: string;
  /** Link with the channel code: in the caption, or in the bio. */
  link: string;
  linkInBio: boolean;
}

export function buildPosts(input: PostsInput): PlatformPost[] {
  const copy = input.messages.posts;
  const hashtags = input.post.hashtags.map((tag) => `#${tag.replace(/^#/, "")}`).join(" ");
  return input.post.channels.map(({ platform, code, linkInBio }) => {
    const link = channelLink(input.linkTemplate, code);
    const call = linkInBio ? copy.linkInBio : link;
    return {
      platform,
      label: copy.platforms[platform],
      text: [input.post.caption.trim(), input.post.disclosure ?? "", call, hashtags].filter((part) => part.length > 0).join("\n\n"),
      link,
      linkInBio,
    };
  });
}

export function postsMarkdown(input: PostsInput): string {
  const copy = input.messages.posts;
  const sections = buildPosts(input).map((post) =>
    [
      `## ${post.label}`,
      "",
      formatMessage(post.linkInBio ? copy.bioLink : copy.postLink, { link: post.link }),
      "",
      "```text",
      post.text,
      "```",
    ].join("\n"),
  );
  return [`# ${formatMessage(copy.title, { title: input.title })}`, "", ...sections.flatMap((s) => [s, ""])].join("\n");
}
