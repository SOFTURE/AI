// Never reaches the database client.
import { readFileSync } from "node:fs";

export const readme = readFileSync("README.md", "utf8");
