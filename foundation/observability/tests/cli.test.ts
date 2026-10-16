import { afterEach, describe, expect, it } from "vitest";

import { EXIT_FAILED, EXIT_OK, EXIT_USAGE, runObservabilityCli } from "../src/cli/run.js";
import { resetObservabilityForTests } from "../src/node/start.js";
import { startOtlpReceiver, type OtlpReceiver } from "./otlp-receiver.js";

const AUTHORIZATION = "Basic c2VjcmV0LWluc3RhbmNlOnNlY3JldC10b2tlbg==";

let receiver: OtlpReceiver | undefined;

afterEach(async () => {
  await resetObservabilityForTests();
  await receiver?.close();
  receiver = undefined;
});

async function run(argv: string[], env: Record<string, string>) {
  const lines: string[] = [];
  const code = await runObservabilityCli({
    argv,
    env,
    output: { log: (line) => lines.push(line), error: (line) => lines.push(line) },
  });
  return { code, text: lines.join("\n") };
}

function exportEnv(url: string): Record<string, string> {
  return {
    OTEL_EXPORTER_OTLP_ENDPOINT: url,
    OTEL_EXPORTER_OTLP_HEADERS: `Authorization=${encodeURIComponent(AUTHORIZATION)}`,
  };
}

describe("softure-observability ping", () => {
  it("exits 0 when both exports are accepted", async () => {
    receiver = await startOtlpReceiver();

    const { code, text } = await run(["ping", "--service-name", "my-service"], exportEnv(receiver.url));

    expect(code).toBe(EXIT_OK);
    expect(text).toBe(`traces: accepted by ${receiver.url}/v1/traces\nlogs: accepted by ${receiver.url}/v1/logs`);
    expect(receiver.bodyOf("/v1/logs").includes("my-service")).toBe(true);
  });

  it.each([401, 404])("exits 1 with the status when the backend answers %i", async (status) => {
    receiver = await startOtlpReceiver({ status });

    const { code, text } = await run(["ping"], exportEnv(receiver.url));

    expect(code).toBe(EXIT_FAILED);
    expect(text).toContain(`traces: refused by ${receiver.url}/v1/traces (HTTP ${String(status)}`);
    expect(text).toContain(`logs: refused by ${receiver.url}/v1/logs (HTTP ${String(status)}`);
    expect(text).not.toContain("c2VjcmV0");
  });

  it("exits 1 when no endpoint is set", async () => {
    const { code, text } = await run(["ping"], {});

    expect(code).toBe(EXIT_FAILED);
    expect(text).toBe("softure-observability: nothing to check, export is disabled (no OTLP endpoint)");
  });

  it("exits 1 naming the variable that is not a URL", async () => {
    const { code, text } = await run(["ping"], { OTEL_EXPORTER_OTLP_ENDPOINT: "not a url" });

    expect(code).toBe(EXIT_FAILED);
    expect(text).toBe("softure-observability: observability: OTEL_EXPORTER_OTLP_ENDPOINT is not a URL");
  });

  it.each([[[]], [["deploy"]], [["ping", "--verbose"]], [["ping", "--service-name"]]])(
    "exits 2 on the usage error %j",
    async (argv) => {
      const { code, text } = await run(argv, {});

      expect(code).toBe(EXIT_USAGE);
      expect(text).toContain("Usage: softure-observability ping");
    },
  );

  it("prints the usage and exits 0 on --help", async () => {
    const { code, text } = await run(["ping", "--help"], {});

    expect(code).toBe(EXIT_OK);
    expect(text).toContain("Usage: softure-observability ping");
  });
});
