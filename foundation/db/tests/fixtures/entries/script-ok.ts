// A script that opens the database for its main.
import { withDatabase } from "./client.js";

await withDatabase((db) => Promise.resolve(db));
