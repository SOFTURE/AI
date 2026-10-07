// Next.js has no `exports` map, so NodeNext resolution (tsconfig.base.json) only finds
// `next/server.js`. The code must still import the bare specifier: Next's bundler aliases it per
// runtime, and the `.js` form bypasses the alias. This declaration gives the bare specifier its types.
declare module "next/server" {
  export * from "next/server.js";
}
