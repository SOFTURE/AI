// The smallest Next.js app that loads the kit the way an adopting app does (its built `dist/`, through the package's
// exports, bundled by Turbopack): `tests/bundler.test.ts` builds it. The settings are the ones the README asks of an app.
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../../../../../", import.meta.url));

export default {
  // The README's one requirement: resvg is a native module, kept out of the bundle.
  serverExternalPackages: ["@resvg/resvg-js"],
  // The kit resolves through the repository's workspace link, outside this folder.
  turbopack: { root: repositoryRoot },
  outputFileTracingRoot: repositoryRoot,
};
