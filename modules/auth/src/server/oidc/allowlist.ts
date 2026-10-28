// Who may sign in through a provider: a verified email listed in `allowedEmails` or of a domain in `allowedDomains`.
import type { OidcProvider } from "../../options.js";
import type { IdentityClaims } from "./id-token.js";

/**
 * The identity's email when it may sign in: verified, and listed in `allowedEmails` or of a domain in
 * `allowedDomains` (with `requireHostedDomain`, the `hd` claim must name that domain too); null otherwise.
 */
export function getAllowedEmail(provider: OidcProvider, claims: IdentityClaims): string | null {
  const { email } = claims;
  if (email === null || !claims.isEmailVerified) return null;
  return isAllowedEmail(provider, email, claims.hostedDomain) ? email : null;
}

/** Whether a verified, lowercased email passes the provider's allowlist. */
export function isAllowedEmail(provider: OidcProvider, email: string, hostedDomain: string | null): boolean {
  if (provider.allowedEmails.includes(email)) return true;
  const at = email.lastIndexOf("@");
  if (at <= 0) return false;
  const domain = email.slice(at + 1);
  if (!provider.allowedDomains.includes(domain)) return false;
  return !provider.requireHostedDomain || hostedDomain === domain;
}
