// The query parameter the confirmation page and its action pass between each other.

/** Set by the action after a submit. */
export const CONFIRM_STATUS_PARAM = "status";

export type ConfirmStatus = "done" | "invalid" | "expired" | "limited" | "failed";
