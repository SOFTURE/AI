import { PLATFORMS, type Film, type Platform } from "../film.js";
import { formatMessage, type MarketingMessages } from "../messages/index.js";

/**
 * Post copy for a film: one `posts.md` with ready text for every platform and a link carrying the
 * channel code (`?z=`), so a visit from the film can be counted.
 *
 * Instagram and TikTok do not turn a link in the caption into a clickable link: there the link goes
 * to the bio and the caption says so. Facebook links in the post.
 */

const LINK_IN_BIO: Record<Platform, boolean> = {
  instagram: true,
  facebook: false,
  tiktok: true,
};

export interface PostsOptions {
  /** The page the film promotes, e.g. `https://example.com/calculator`; the channel code is appended. */
  site: string;
  messages: MarketingMessages;
}

export function channelLink(site: string, code: string): string {
  return `${site}?z=${code}`;
}

export interface PlatformPost {
  platform: Platform;
  label: string;
  /** Text to paste under the film. */
  text: string;
  /** Link with the channel code: in the caption (Facebook) or in the bio (the rest). */
  link: string;
  linkInBio: boolean;
}

export function buildPosts(film: Film, options: PostsOptions): PlatformPost[] {
  const copy = options.messages.posts;
  const hashtags = film.post.hashtags.map((tag) => `#${tag.replace(/^#/, "")}`).join(" ");
  return PLATFORMS.map((platform) => {
    const link = channelLink(options.site, film.channels[platform]);
    const linkInBio = LINK_IN_BIO[platform];
    const call = linkInBio ? copy.linkInBio : link;
    return {
      platform,
      label: copy.platforms[platform],
      text: [film.post.caption.trim(), call, hashtags].filter((part) => part.length > 0).join("\n\n"),
      link,
      linkInBio,
    };
  });
}

export function postsMarkdown(film: Film, options: PostsOptions): string {
  const copy = options.messages.posts;
  const sections = buildPosts(film, options).map((post) =>
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
  return [`# ${formatMessage(copy.title, { title: film.title })}`, "", ...sections.flatMap((s) => [s, ""])].join("\n");
}
