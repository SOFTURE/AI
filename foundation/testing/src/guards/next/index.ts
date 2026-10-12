// Next.js server-action guards of @softure-ai/testing (`@softure-ai/testing/guards/next`): architecture
// rules every app on SOFTURE packages follows, read from the syntax of its source files with the
// TypeScript parser (`typescript` must be installed, an optional peer dependency). Each rule returns
// `file:line: message` for every hit, so `expect(…).toEqual([])` lists all of them in one run.
import type { SourceFile } from "../source-files.js";
import { findNonAsyncServerExports } from "./async-exports.js";
import { findClientValueImports, type ClientImportOptions } from "./client-imports.js";
import { findImplementationsWithoutDatabase, type DatabaseHandleOptions } from "./database-handle.js";
import { findErrorDetailsInRedirects } from "./redirect-errors.js";
import { findRequestApisInImplementations, type RequestApiOptions } from "./request-apis.js";
import { findUnguardedRevalidation } from "./revalidation.js";
import { sortHits } from "./syntax.js";

export { findNonAsyncServerExports } from "./async-exports.js";
export { findClientValueImports, type ClientImportOptions } from "./client-imports.js";
export { findImplementationsWithoutDatabase, type DatabaseHandleOptions } from "./database-handle.js";
export {
  DEFAULT_DATABASE_NAME,
  DEFAULT_ERROR_PARAMS,
  DEFAULT_IMPLEMENTATION,
  DEFAULT_REQUEST_APIS,
  type ImplementationOptions,
  type RequestApi,
} from "./options.js";
export { findErrorDetailsInRedirects, type RedirectErrorOptions } from "./redirect-errors.js";
export { findRequestApisInImplementations, type RequestApiOptions } from "./request-apis.js";
export { findUnguardedRevalidation } from "./revalidation.js";

export interface ServerActionGuardOptions extends RequestApiOptions, DatabaseHandleOptions, ClientImportOptions {
  /** Query parameters that must not carry free text in a redirect (rule 6). */
  errorParams?: readonly string[];
}

/** All six server-action rules over the files, sorted by file and line. */
export function findServerActionProblems(files: readonly SourceFile[], options: ServerActionGuardOptions = {}): string[] {
  return sortHits([
    ...findNonAsyncServerExports(files),
    ...findUnguardedRevalidation(files),
    ...findRequestApisInImplementations(files, options),
    ...findImplementationsWithoutDatabase(files, options),
    ...findClientValueImports(files, options),
    ...findErrorDetailsInRedirects(files, options.errorParams === undefined ? {} : { params: options.errorParams }),
  ]);
}
