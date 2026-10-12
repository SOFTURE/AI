// Opens through the client module at startup, reaches it through lib.ts.
import { open } from "./client.js";
import { countNotes } from "./lib.js";

export async function register(): Promise<void> {
  await open();
  await countNotes();
}
