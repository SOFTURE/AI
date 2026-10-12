// Next.js has no `exports` map, so NodeNext resolution only finds `next/link.js` and `next/navigation.js`. The code
// must still import the bare specifiers: Next's bundler aliases them per runtime, and the `.js` form bypasses the
// alias (lesson L-002). This gives the bare ones their types. `next/link.js` is CommonJS, so its default export is
// typed from the component's own declaration.
declare module "next/link" {
  const Link: typeof import("next/dist/client/link.js").default;
  export default Link;
}

declare module "next/navigation" {
  export * from "next/navigation.js";
}
