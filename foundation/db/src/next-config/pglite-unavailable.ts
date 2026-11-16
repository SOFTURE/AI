// What a Cloudflare build bundles in place of PGlite and drizzle's PGlite driver (`withDatabaseBuild`): workerd cannot
// run PGlite, and this package only imports it for a `pglite://` URL, which a Worker never has (its URL is the
// Hyperdrive binding's `postgres://` string). Bundling the real package would also need it installed.
const MESSAGE = "PGlite is not available on Cloudflare Workers: use a postgres:// URL (a Hyperdrive binding)";

export class PGlite {
  constructor() {
    throw new Error(MESSAGE);
  }
}

export const types = {};

export function drizzle(): never {
  throw new Error(MESSAGE);
}
