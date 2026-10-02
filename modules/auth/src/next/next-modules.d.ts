// Next.js has no `exports` map, so NodeNext resolution (tsconfig.base.json) only finds
// `next/navigation.js` and `next/headers.js`. The code must still import the bare specifiers:
// Next's bundler aliases them per runtime, and the `.js` form bypasses the alias (measured:
// `next build` failed to collect a route handler importing `next/navigation.js`, MODULE_UNPARSABLE
// on the vendored app-router context). These declarations give the bare specifiers their types.
declare module "next/navigation" {
  export * from "next/navigation.js";
}

declare module "next/headers" {
  export * from "next/headers.js";
}

declare module "next/server" {
  export * from "next/server.js";
}
