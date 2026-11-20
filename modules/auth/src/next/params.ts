// Query parameters the adapter's pages and actions pass between each other.

/** Set on the login page after a password reset, so it confirms the change. */
export const PASSWORD_RESET_DONE_PARAM = "reset";

/** Set on the login page after a failed OpenID Connect sign-in: the error code it shows. */
export const OIDC_ERROR_PARAM = "oidc_error";

/** Set on the invitations page after an action, so it confirms it: `sent`, `resent` or `revoked`. */
export const INVITATION_NOTICE_PARAM = "notice";

export const INVITATION_NOTICES = ["sent", "resent", "revoked"] as const;
export type InvitationNotice = (typeof INVITATION_NOTICES)[number];
