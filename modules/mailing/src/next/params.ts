// The query parameter the unsubscribe page and its action pass between each other.

/** Set by the action after a submit: `done`, `invalid` or `failed`. */
export const UNSUBSCRIBE_STATUS_PARAM = "status";

export type UnsubscribeStatus = "done" | "invalid" | "failed";
