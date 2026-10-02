// Runs once at server start: importing the config registers it for package code
// (`getSoftureConfig()` in `@softure-ai/core/next`). Only the Node.js runtime needs it.
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./softure.config.ts");
  }
}
