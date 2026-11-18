// The one-time state and the PKCE verifier of a user's authorization, on Web Crypto (Node and Workers alike). The app
// stores only the state's sha256 (`stateHash`), bound to the signed-in user, beside the verifier, and consumes it once
// on the callback; the state itself travels through the browser only.

/** A new authorization's secrets: the state for the URL, its hash for the app's record, and a PKCE verifier. */
export interface UserOAuthState {
  /** 32 random bytes, base64url (43 characters): goes into the authorize URL, never into storage. */
  readonly state: string;
  /** The state's sha256, lowercase hex (64 characters): what the app stores and looks up on the callback. */
  readonly stateHash: string;
  /** 32 random bytes, base64url: the PKCE verifier the token exchange sends. */
  readonly codeVerifier: string;
}

export async function createUserOAuthState(): Promise<UserOAuthState> {
  const state = createRandomToken();
  return { state, stateHash: await hashUserOAuthState(state), codeVerifier: createRandomToken() };
}

/** The sha256 of a state from a callback URL, lowercase hex, to find the app's record of it. */
export async function hashUserOAuthState(state: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(state)));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** The PKCE S256 challenge of a verifier (RFC 7636 §4.2). */
export async function createCodeChallenge(codeVerifier: string): Promise<string> {
  return toBase64Url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(codeVerifier))));
}

function createRandomToken(): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const padded = btoa(binary).replaceAll("+", "-").replaceAll("/", "_");
  let end = padded.length;
  while (end > 0 && padded[end - 1] === "=") end -= 1;
  return padded.slice(0, end);
}
