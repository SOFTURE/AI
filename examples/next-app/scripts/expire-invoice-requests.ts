// Closes the invoice requests nobody asked again for in billing({ requests: { expireAfterDays } })
// days and clears their invoice details: `npm run expire-invoice-requests`, run daily by a
// scheduler (cron, a platform job). A repeated run closes nothing new (docs:
// modules/billing/README.md, "Invoice requests").
import { expireStaleRequests } from "@softure-ai/billing/server";
import { systemClock } from "@softure-ai/core";
import { createDatabase } from "@softure-ai/db";
import config from "../softure.config.ts";

if (config.database === null) throw new Error("expire-invoice-requests: softure.config.ts has no database");
const database = await createDatabase(config.database.url, { max: 1 });
try {
  console.log(JSON.stringify(await expireStaleRequests({ db: database.db, clock: systemClock, config })));
} finally {
  await database.close();
}
