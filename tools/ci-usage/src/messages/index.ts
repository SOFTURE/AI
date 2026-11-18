import { en } from "./en.js";

export type CiUsageMessages = { [Key in keyof typeof en]: string };

/** The copy of the report; an app passes its own object of the same shape to change the wording. */
export const ciUsageMessages: { en: CiUsageMessages } = { en };

/** Replaces every `{name}` in `template` with its value; an unknown placeholder is a bug, so it throws. */
export function formatMessage(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{([a-zA-Z]+)\}/g, (placeholder, name: string) => {
    const value = values[name];
    if (value === undefined) throw new Error(`formatMessage: no value for ${placeholder} in "${template}".`);
    return String(value);
  });
}
