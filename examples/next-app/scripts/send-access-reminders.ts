// Mails the accounts whose trial or paid access ends soon or has just ended:
// `npm run access-reminders`, run daily by a scheduler (cron, a platform job). Each mail goes out
// once per account and window, so a repeated run sends nothing new (docs:
// modules/billing/README.md, "Reminder mail").
import { sendAccessReminders } from "@softure-ai/billing/mailing";
import { systemClock } from "@softure-ai/core";
import { createDatabase } from "@softure-ai/db";
import config from "../softure.config.ts";

if (config.database === null) throw new Error("send-access-reminders: softure.config.ts has no database");
const database = await createDatabase(config.database.url, { max: 1 });
try {
  console.log(JSON.stringify(await sendAccessReminders({ db: database.db, clock: systemClock, config })));
} finally {
  await database.close();
}
