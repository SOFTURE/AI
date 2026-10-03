// Next.js has no `exports` map, so NodeNext resolution (tsconfig.base.json) only finds
// `next/headers.js` and `next/navigation.js`. The code must still import the bare specifiers: Next's
// bundler aliases them per runtime, and the `.js` form bypasses the alias (identity ID-1). This gives
// the bare ones their types.
declare module "next/headers" {
  export * from "next/headers.js";
}

declare module "next/navigation" {
  export * from "next/navigation.js";
}
