// Where the example keeps the channel each account signed up from: process memory, so the demo
// needs no table. A real app saves it in its own table (with a privacy contributor) or counts it
// without the account (the analytics funnel). Kept on globalThis, like the database handle, so the
// register action and the account page share it whatever chunk Next puts them in.
const store = globalThis as typeof globalThis & { softureExampleSignupChannels?: Map<string, string> };

function getStore(): Map<string, string> {
  store.softureExampleSignupChannels ??= new Map();
  return store.softureExampleSignupChannels;
}

export function rememberSignupChannel(userId: string, channel: string): void {
  getStore().set(userId, channel);
}

export function findSignupChannel(userId: string): string | null {
  return getStore().get(userId) ?? null;
}
