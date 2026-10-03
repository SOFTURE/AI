// The field names the waitlist form sends and the join action reads, shared by both sides (the
// form is a client module, so the action cannot import from it).

/** The field with the address. */
export const EMAIL_FIELD = "email";
/** The hidden field with the form's placement. */
export const PLACEMENT_FIELD = "placement";

/** The field name of a scope's checkbox. */
export function getScopeFieldName(scopeId: string): string {
  return `scope.${scopeId}`;
}
