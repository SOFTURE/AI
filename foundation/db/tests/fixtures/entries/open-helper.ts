// The app's own opening helper.
import { open } from "./client.js";

export async function openConfiguredDatabase(): Promise<void> {
  await open();
}
