import { createLogger } from "../../src/index.js";
import { startObservability } from "../../src/node/index.js";

// A one-shot script: it never calls `shutdown()` and ends when its work is done.
startObservability({ serviceName: "short-lived-child", endpoint: process.env.CHILD_ENDPOINT, lifetime: "short" });

createLogger("script").info("migration done");
process.exitCode = 3;
