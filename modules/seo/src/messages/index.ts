import { en } from "./en.js";
import { pl } from "./pl.js";

/** Complete default dictionaries; apps pass partial overrides per locale. */
export const seoMessages = { en, pl };

export type SeoMessages = typeof en;
