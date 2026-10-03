// Next.js has no `exports` map, so NodeNext resolution (tsconfig.base.json) only finds
// `next/headers.js`. The code must still import the bare specifier: Next's bundler aliases it per
// runtime, and the `.js` form bypasses the alias (identity ID-1). This gives the bare one its types.
declare module "next/headers" {
  export * from "next/headers.js";
}
