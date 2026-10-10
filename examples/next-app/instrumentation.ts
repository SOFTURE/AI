import { createLogger } from "@softure-ai/observability";
import { createOnRequestError, registerObservability } from "@softure-ai/observability/next";

// Runs once at server start: importing the config registers it for package code
// (`getSoftureConfig()` in `@softure-ai/core/next`). Only the Node.js runtime needs it. `next build`
// prerenders static pages without it, so app/layout.tsx imports the config as well.
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./softure.config.ts");
  }
  // Exports nothing unless OTEL_EXPORTER_OTLP_ENDPOINT is set; the names are placeholders of this example.
  await registerObservability({ serviceName: "example-web", serviceNamespace: "softure-example" });
}

export const onRequestError = createOnRequestError(createLogger("next"));
