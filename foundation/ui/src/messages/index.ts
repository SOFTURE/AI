import type { Dictionaries } from "@softure-ai/core";
import { en } from "./en.js";
import { pl } from "./pl.js";

export type UiMessages = typeof en;

/** Copy of the package's components, per locale. */
export const uiMessages: Dictionaries<UiMessages> = { en, pl };
