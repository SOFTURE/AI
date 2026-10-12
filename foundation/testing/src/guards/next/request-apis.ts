import type { SourceFile } from "../source-files.js";
import { DEFAULT_IMPLEMENTATION, DEFAULT_REQUEST_APIS, type ImplementationOptions, type RequestApi } from "./options.js";
import { formatHit, parseFiles, readValueImports } from "./syntax.js";

export interface RequestApiOptions extends ImplementationOptions {
  /** The request-scoped APIs. Default: {@link DEFAULT_REQUEST_APIS}. */
  requestApis?: readonly RequestApi[];
}

/**
 * Rule 3: implementation modules (the layer that receives `database` and `now`) never use a
 * request-scoped API; only the thin action reads the request and passes what it read on. Reported at
 * the import, under any alias, so a call through a variable is caught too.
 */
export function findRequestApisInImplementations(files: readonly SourceFile[], options: RequestApiOptions = {}): string[] {
  const implementation = options.implementation ?? DEFAULT_IMPLEMENTATION;
  const apis = options.requestApis ?? DEFAULT_REQUEST_APIS;
  return parseFiles(files.filter(({ file }) => implementation.test(file))).flatMap((parsed) =>
    readValueImports(parsed.tree).flatMap((imported) => {
      const api = apis.find(({ module }) => module === imported.module);
      if (api === undefined) return [];
      const names = imported.imported === "*" ? api.names : api.names.filter((name) => name === imported.imported);
      return names.map((name) =>
        formatHit(parsed, imported.node, `implementation module uses the request-scoped ${name}() from ${api.module}; read it in the action and pass the value in`),
      );
    }),
  );
}
