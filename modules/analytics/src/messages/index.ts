import { en } from "./en.js";
import { pl } from "./pl.js";

export type AnalyticsMessages = typeof en;

/** Complete default dictionaries; apps pass partial overrides per locale. */
export const analyticsMessages = { en, pl };
