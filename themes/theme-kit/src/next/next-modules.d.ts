// Next.js has no `exports` map, so NodeNext resolution (tsconfig.base.json) only finds `next/*.js`.
// The code must still import the bare specifiers: Next's bundler aliases them per runtime, and the
// `.js` form bypasses the alias (lessons L-002). This declaration gives the bare specifier its types.
declare module "next/og" {
  export * from "next/og.js";
}
