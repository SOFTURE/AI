import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite ships a WASM Postgres whose filesystem setup breaks when bundled, and pg loads native
  // bindings optionally; both load from node_modules on the server (FIRE_TRACKER next.config.ts).
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
  poweredByHeader: false,
  // Resolve only inside this folder. Above it lies the repository's node_modules, whose workspace
  // links would quietly stand in for a packed copy that lacks a file (measured: with `dist` dropped
  // from ui's `files`, the build still passed until this was set).
  turbopack: {
    root: import.meta.dirname,
  },
};

export default nextConfig;
