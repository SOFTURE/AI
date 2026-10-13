import { type DeepPartial, type Dictionaries, type Locale, mergeMessages, selectMessages } from "@softure-ai/core";
import { en } from "./en.js";

export type ChartsMessages = typeof en;

/** Copy of the package's components: English, the only built-in language. */
export const chartsMessages: Dictionaries<ChartsMessages> = { en };

/** The copy props of every component with built-in text. */
export interface ChartsCopyProps {
  /** Locale of the built-in copy; a client component falls back to `UiLocaleProvider`, then `en`. */
  readonly locale?: Locale;
  /** Partial copy overrides, or the app's own translation, for the current locale. */
  readonly messages?: DeepPartial<ChartsMessages>;
}

/** The package's copy in `locale`, with the app's partial overrides applied. */
export function getChartsCopy({ locale = "en", messages }: ChartsCopyProps): ChartsMessages {
  return selectMessages(mergeMessages(chartsMessages, { [locale]: messages }), locale);
}
