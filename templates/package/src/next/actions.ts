"use server";
// Server actions ready to mount in a Next.js app. The directive must survive the build: `tsc`
// keeps it per file, which is why packages are built with tsc and not bundled (FD-1 decision).

/** Placeholder server action. */
export async function pingAction(): Promise<string> {
  return Promise.resolve("pong");
}
