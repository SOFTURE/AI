/** Request-scoped APIs: names a module exports that read the current request. */
export interface RequestApi {
  module: string;
  names: readonly string[];
}

/** Next.js's request-scoped APIs. Add an app's own wrappers (`{ module: "@/lib/session", names: ["getSession"] }`). */
export const DEFAULT_REQUEST_APIS: readonly RequestApi[] = [
  { module: "next/headers", names: ["cookies", "headers", "draftMode"] },
  { module: "next/server", names: ["connection"] },
];

/** The implementation layer by default: files named `do-*` or `manage-*`. */
export const DEFAULT_IMPLEMENTATION = /(?:^|\/)(?:do|manage)-[^/]+$/;

/** The database handle by default: a parameter or option named `database` or `db`. */
export const DEFAULT_DATABASE_NAME = /^(?:database|db)$/;

/** Query parameters that must not carry free text in a redirect by default. */
export const DEFAULT_ERROR_PARAMS: readonly string[] = ["error", "message", "reason", "details"];

/** The layer naming of rules 3 and 4. */
export interface ImplementationOptions {
  /** Which files are the implementation layer, matched against `file`. Default: {@link DEFAULT_IMPLEMENTATION}. */
  implementation?: RegExp;
}
