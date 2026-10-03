"use server";

// A write behind the billing guard: a guestbook entry signed as a member. `requireWriteAccess`
// runs before the form is read; a visitor without a session goes to the login page, and a
// read-only account gets `billing.read_only` back, so nothing is written.
import { requireWriteAccess } from "@softure-ai/billing/next";
import { err } from "@softure-ai/core";
import type { ActionResult } from "@softure-ai/ui";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDatabase } from "../../../lib/database.ts";
import { GUESTBOOK_MESSAGE_MAX_LENGTH } from "../../../modules/guestbook/limits.ts";
import { insertEntry } from "../../../modules/guestbook/queries.ts";

const entryInput = z.object({
  message: z.string().trim().min(1).max(GUESTBOOK_MESSAGE_MAX_LENGTH),
});

export async function signAsMember(formData: FormData): Promise<ActionResult> {
  const access = await requireWriteAccess({ next: "/account/billing" });
  if (!access.ok) return access;

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
