// The spike module (identity ID-1). It exists to prove how a module package reaches a Next.js app:
// a server action, a route handler and a server component page, all shipped from `node_modules`.
import { defineModule, resolveMigrationsDir } from "@softure-ai/core";
import { nextActionsMessages } from "./messages/index.js";

export const nextActions = defineModule({
  manifest: {
    id: "next-actions",
    version: "0.0.0",
    dependsOn: {},
    dbSchema: "next_actions",
    tables: ["pings"],
    env: [],
    switches: [],
    routes: { page: "/spike/next-actions", api: "/api/spike/next-actions" },
    mount: [],
    privacy: { exports: false, deletes: false },
  },
  messages: nextActionsMessages,
  migrations: { dir: resolveMigrationsDir(import.meta.url, "../migrations/") },
});

export { nextActionsMessages, type NextActionsMessages } from "./messages/index.js";
