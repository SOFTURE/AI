import { en } from "./en.js";

/** The built-in English dictionary; an app passes partial overrides or its own translation per locale. */
export const filesMessages = { en };

export type FilesMessages = typeof en;

/** The copy for an error code (`files.*`); an unknown code gets the generic failure. */
export function getFilesErrorMessage(messages: FilesMessages, code: string): string {
  const name = code.startsWith("files.") ? code.slice("files.".length) : "";
  const group: Readonly<Record<string, string>> = messages.errors.files;
  return (Object.hasOwn(group, name) ? group[name] : undefined) ?? messages.errors.core.unexpected;
}
