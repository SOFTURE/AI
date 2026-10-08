import { en } from "./en.js";
import { pl } from "./pl.js";

/** Complete default dictionaries; apps pass partial overrides per locale. */
export const agentReadyMessages = { en, pl };

export type AgentReadyMessages = typeof en;
