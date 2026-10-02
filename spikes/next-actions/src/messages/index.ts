import type { Dictionaries } from "@softure-ai/core";
import { en } from "./en.js";
import { pl } from "./pl.js";

export type NextActionsMessages = { readonly [Key in keyof typeof en]: string };

export const nextActionsMessages: Dictionaries<NextActionsMessages> = { en, pl };
