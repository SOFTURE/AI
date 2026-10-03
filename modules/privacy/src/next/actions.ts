"use server";

// The account deletion action. The user comes from the session (never from a bound argument or
// the form, which the client controls, docs/02 §8) before the form is read; unexpected failures
// become `safeError` codes. Next refuses an action whose Origin does not match the host.
import { getCurrentUser } from "@softure-ai/auth/next";
import { errorLogLabel, safeError } from "@softure-ai/core";
import { getSoftureConfig } from "@softure-ai/core/next";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { DeleteAccountErrorCode, DeleteAccountField, DeleteAccountFormState } from "../contract.js";
import { getPrivacyRoutes } from "../server/options.js";
import { deleteOwnAccount } from "../server/self-service.js";
import { getPrivacyContext } from "./context.js";
import { clearSessionCookie } from "./session-cookie.js";

/** Longer values are cut: auth refuses them anyway, and nothing huge is hashed. */
const MAX_FIELD_LENGTH = 4096;

const deleteAccountInput = z.object({
  password: z
    .string()
    .catch("")
    .transform((value) => value.slice(0, MAX_FIELD_LENGTH)),
  // A checked HTML checkbox sends "on" (or its value); an unchecked one sends nothing.
  confirm: z.string().nullable().catch(null),
});

const FIELD_OF: Partial<Record<DeleteAccountErrorCode, DeleteAccountField>> = {
  "privacy.password_invalid": "password",
  "privacy.confirmation_required": "confirm",
};

function failure(error: DeleteAccountErrorCode): DeleteAccountFormState {
  const field = FIELD_OF[error];
  return field === undefined ? { status: "error", error } : { status: "error", error, field };
}

/** Deletes the signed-in user's account, ends the browser's session and goes to `afterDelete`. */
export async function deleteAccountAction(_previous: DeleteAccountFormState, formData: FormData): Promise<DeleteAccountFormState> {
  const config = getSoftureConfig();
  let result;
  try {
    const user = await getCurrentUser();
    if (user === null) return failure("auth.unauthenticated");
    // Every field has a `catch`, so parsing cannot fail.
    const input = deleteAccountInput.parse({ password: formData.get("password"), confirm: formData.get("confirm") });
    result = await deleteOwnAccount(await getPrivacyContext(config), {
      userId: user.id,
      password: input.password,
      isConfirmed: input.confirm !== null,
    });
  } catch (error) {
    console.error(`@softure-ai/privacy: account deletion failed: ${errorLogLabel(error)}`);
    return failure(safeError(error).error);
  }
  if (!result.ok) return failure(result.error);

  await clearSessionCookie(config);
  redirect(getPrivacyRoutes(config).afterDelete);
}
