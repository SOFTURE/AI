import { en } from "./en.js";

/** The built-in English dictionary; an app passes partial overrides or its own translation per locale. */
export const connectionsMessages = { en };

export type ConnectionsMessages = typeof en;

/**
 * The copy for an error code (a `ConnectionsFormErrorCode`, or a stored `last_error`, which is read as a string);
 * an unknown code gets the generic failure.
 */
export function getConnectionsErrorMessage(messages: ConnectionsMessages, code: string): string {
  const separator = code.lastIndexOf(".");
  const namespace = code.slice(0, separator);
  const name = code.slice(separator + 1);
  const groups = messages.errors as Readonly<Record<string, Readonly<Record<string, string>>>>;
  const group = Object.hasOwn(groups, namespace) ? groups[namespace] : undefined;
  return (group !== undefined && Object.hasOwn(group, name) ? group[name] : undefined) ?? messages.errors.core.unexpected;
}
