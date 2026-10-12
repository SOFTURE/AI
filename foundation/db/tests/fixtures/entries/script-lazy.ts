// Reaches the client only through a dynamic import, and opens it with the app's own helper.
import { openConfiguredDatabase } from "./open-helper.js";

await openConfiguredDatabase();
await import("./lib.js");
