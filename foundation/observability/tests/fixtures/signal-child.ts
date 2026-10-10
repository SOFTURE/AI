import { createLogger } from "../../src/index.js";
import { startObservability } from "../../src/node/index.js";

startObservability({ serviceName: "signal-child", endpoint: process.env.CHILD_ENDPOINT, handleSignals: true });

if (process.env.CHILD_APP_HANDLER === "1") {
  process.on("SIGTERM", () => {
    console.log("app handler ran");
    setTimeout(() => process.exit(0), 1_000);
  });
}

createLogger("child").info("before the signal");
console.log("ready");
setInterval(() => undefined, 1_000);
