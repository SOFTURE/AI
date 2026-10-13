import type { Dictionaries } from "@softure-ai/core";
import { en } from "./en.js";

export type UiMessages = typeof en;

/** Copy of the package's components: English, the only built-in language. */
export const uiMessages: Dictionaries<UiMessages> = { en };
