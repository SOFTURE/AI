import { type DeepPartial, type Dictionaries, type Locale, mergeMessages } from "@softure-ai/core";
import { en } from "./en.js";
import { pl } from "./pl.js";

export type ChartsMessages = typeof en;

/** Copy of the package's components, per locale. */
export const chartsMessages: Dictionaries<ChartsMessages> = { en, pl };

/** The copy props of every component with built-in text. */
export interface ChartsCopyProps {
  /** Locale of the built-in copy; `en` by default. */
  readonly locale?: Locale;
  /** Partial copy overrides for the current locale. */
  readonly messages?: DeepPartial<ChartsMessages>;
}

/** The package's copy in `locale`, with the app's partial overrides applied. */
export function getChartsCopy({ locale = "en", messages }: ChartsCopyProps): ChartsMessages {
  return mergeMessages(chartsMessages, { [locale]: messages })[locale];
}
