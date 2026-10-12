// The app's database module: a module-level db that entry points must open.
import { createProcessDatabase } from "@softure-ai/db";

export const { db, open, withDatabase } = createProcessDatabase(() => process.env.DATABASE_URL ?? "");
