import { en } from "./en.js";
import { pl } from "./pl.js";

export type BlogMessages = typeof en;

/** Complete default dictionaries; apps pass partial overrides per locale. */
export const blogMessages = { en, pl };
