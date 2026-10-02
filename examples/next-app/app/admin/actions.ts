"use server";

// The admin panel's action: an announcement in the guestbook. The role is checked first, from the
// session, before the form is read; a refusal comes back to the form as `auth.forbidden`.
import { authorizeRole } from "@softure-ai/auth/next";
import { ADMIN_ROLE } from "@softure-ai/auth";
import { err } from "@softure-ai/core";
import type { ActionResult } from "@softure-ai/ui";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDatabase } from "../../lib/database.ts";
import { GUESTBOOK_MESSAGE_MAX_LENGTH } from "../../modules/guestbook/limits.ts";
import { insertEntry } from "../../modules/guestbook/queries.ts";

const announcementInput = z.object({
  message: z.string().trim().min(1).max(GUESTBOOK_MESSAGE_MAX_LENGTH),
});

export async function postAnnouncement(formData: FormData): Promise<ActionResult> {
  const admin = await authorizeRole(ADMIN_ROLE);
  if (!admin.ok) return admin;

  const input = announcementInput.safeParse({ message: formData.get("message") });
  if (!input.success) {
    return { ...err("guestbook.message_invalid"), fieldErrors: { message: "guestbook.message_invalid" } };
  }
  const { db } = await getDatabase();
  const result = await insertEntry(db, input.data.message);
  if (!result.ok) return result;
  revalidatePath("/");
  return result;
}
