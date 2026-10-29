// Next.js has no `exports` map, so NodeNext resolution (tsconfig.base.json) only finds `next/*.js`.
// theme-kit's icon drawing imports the bare `next/og` (Next's bundler aliases it per runtime); type-checking it
// from this package's sources needs the same declaration theme-kit carries.
declare module "next/og" {
  export * from "next/og.js";
}
