// The files options of the running app, read from the configuration in the module context.
import { getModule, type SoftureConfig } from "@softure-ai/core";
import type { FilesOptions } from "../options.js";

const MODULE_ID = "files";

/** The enabled module. Throws when the app did not enable it: calling its functions then is a bug. */
export function getFilesModule(config: SoftureConfig) {
  const module = getModule(config, MODULE_ID);
  if (module === undefined) {
    throw new Error("@softure-ai/files: the module is not enabled; add files({ storage }) to modules in softure.config.ts");
  }
  return module;
}

export function getFilesOptions(config: SoftureConfig): FilesOptions {
  // The module factory parsed these options with filesOptionsSchema.
  return getFilesModule(config).options as FilesOptions;
}

/** The path prefix of public links after the app's override (`files({ routes: { links } })`), without a trailing slash. */
export function getLinksRoute(config: SoftureConfig): string {
  const { links } = getFilesModule(config).routes;
  // The manifest declares it, so a missing one means a broken module definition.
  if (links === undefined) throw new Error("@softure-ai/files: the links route is missing from the module manifest");
  return trimTrailingSlashes(links);
}

/** The path without trailing slashes; a loop, not `/\/+$/`, which backtracks quadratically on a run of slashes. */
function trimTrailingSlashes(path: string): string {
  let end = path.length;
  while (end > 0 && path[end - 1] === "/") end -= 1;
  return path.slice(0, end);
}
