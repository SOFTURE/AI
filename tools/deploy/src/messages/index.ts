import { en } from "./en.js";
import { pl } from "./pl.js";

export type DeployMessages = typeof en;

/** Complete default dictionaries of the copy that ends up in a release report. */
export const deployMessages = { en, pl };

export type DeployLocale = keyof typeof deployMessages;

export const DEPLOY_LOCALES = Object.keys(deployMessages) as DeployLocale[];

export function isDeployLocale(value: string): value is DeployLocale {
  return Object.hasOwn(deployMessages, value);
}

export function getDeployMessages(locale: DeployLocale): DeployMessages {
  return deployMessages[locale];
}

/** Replaces every `{name}` in `template` with its value; an unknown placeholder is a bug, so it throws. */
export function formatMessage(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{([a-zA-Z]+)\}/g, (placeholder, name: string) => {
    const value = values[name];
    if (value === undefined) throw new Error(`formatMessage: no value for ${placeholder} in "${template}".`);
    return String(value);
  });
}
