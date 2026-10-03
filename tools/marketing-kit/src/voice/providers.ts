import { createElevenLabsProvider, ELEVENLABS_API_KEY_ENV } from "./elevenlabs.js";
import type { TtsProvider } from "./provider.js";

/** The providers `voice.provider` may name in `marketing.json`. */
export type TtsProviderId = "elevenlabs";

export interface CreateTtsProviderOptions {
  env: Record<string, string | undefined>;
  fetch?: typeof globalThis.fetch;
}

/** The configured provider with its credentials from the environment (read, never logged). */
export function createTtsProvider(id: TtsProviderId, options: CreateTtsProviderOptions): TtsProvider {
  switch (id) {
    case "elevenlabs":
      return createElevenLabsProvider({ apiKey: options.env[ELEVENLABS_API_KEY_ENV], fetch: options.fetch });
  }
}
