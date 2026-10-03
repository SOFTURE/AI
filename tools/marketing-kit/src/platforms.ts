/**
 * The social platforms a film's post copy can target, and the channel codes their links carry so a
 * visit from a film can be counted.
 */

export const PLATFORMS = ["instagram", "facebook", "tiktok", "youtube", "linkedin", "x"] as const;

export type Platform = (typeof PLATFORMS)[number];

/**
 * Whether a link in the caption is not clickable on the platform, so the link goes to the bio and
 * the caption says so. A project can override it per platform.
 */
export const DEFAULT_LINK_IN_BIO: Record<Platform, boolean> = {
  instagram: true,
  facebook: false,
  tiktok: true,
  youtube: true,
  linkedin: false,
  x: false,
};

/**
 * The channel rule of `@softure-ai/analytics` (its default `pattern` and `maxLength`), the reader on
 * the app that receives the link: lowercase words joined by single dashes or underscores. Any other
 * code would make visits from the film uncountable.
 */
export const CHANNEL_CODE_PATTERN = /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/;
export const CHANNEL_CODE_MAX_LENGTH = 32;

export function isChannelCode(code: string): boolean {
  return code.length <= CHANNEL_CODE_MAX_LENGTH && CHANNEL_CODE_PATTERN.test(code);
}

/** The link a platform's post carries: the template with `{code}` replaced. */
export function channelLink(linkTemplate: string, code: string): string {
  return linkTemplate.replaceAll("{code}", encodeURIComponent(code));
}
