"use server";

// The guestbook's server action. The example has no users, so there is no authorization to check;
// a real module checks it here before anything else (docs/02-module-standard.md §8).
import { err } from "@softure-ai/core";
import type { ActionResult } from "@softure-ai/ui";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDatabase } from "../lib/database.ts";
import { GUESTBOOK_MESSAGE_MAX_LENGTH } from "../modules/guestbook/index.ts";
import { insertEntry } from "../modules/guestbook/queries.ts";

const entryInput = z.object({
  message: z.string().trim().min(1).max(GUESTBOOK_MESSAGE_MAX_LENGTH),
});

export async function addGuestbookEntry(formData: FormData): Promise<ActionResult> {
  const input = entryInput.safeParse({ message: formData.get("message") });
  if (!input.success) {
    return { ...err("guestbook.message_invalid"), fieldErrors: { message: "guestbook.message_invalid" } };
  }
  const { db } = await getDatabase();
  const result = await insertEntry(db, input.data.message);
  if (!result.ok) return result;
  revalidatePath("/");
  return result;
}
