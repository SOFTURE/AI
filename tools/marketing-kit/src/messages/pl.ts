import type { en } from "./en.js";

// Polish copy lives only in message dictionaries; the language gate exempts `messages/` folders.
export const pl: typeof en = {
  posts: {
    title: "{title} — opisy postów",
    linkInBio: "Link w bio.",
    bioLink: "Link do bio: {link}",
    postLink: "Link w poście: {link}",
    platforms: {
      instagram: "Instagram (Reels)",
      facebook: "Facebook (Reels / post)",
      tiktok: "TikTok",
    },
  },
  film: {
    persona: "{name}, {age} lat",
  },
};
