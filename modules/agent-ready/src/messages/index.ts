import { en } from "./en.js";

/** The built-in English dictionary; an app passes partial overrides or its own translation per locale. */
export const agentReadyMessages = { en };

export type AgentReadyMessages = typeof en;
