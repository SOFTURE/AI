// Next.js has no `exports` map, so NodeNext resolution (tsconfig.base.json) only finds `next/*.js`.
// The code must still import the bare specifiers: Next's bundler aliases them per runtime, and the
// `.js` form bypasses the alias (docs/02-module-standard.md §8, measured in @softure-ai/waitlist).
// These declarations give the bare specifiers their types.
declare module "next/cache" {
  export * from "next/cache.js";
}

declare module "next/navigation" {
  export * from "next/navigation.js";
}

declare module "next/og" {
  export * from "next/og.js";
}
