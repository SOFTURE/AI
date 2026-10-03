import type { MarketingConfig } from "../config/config.js";
import { createElevenLabsProvider, ELEVENLABS_API_KEY_ENV } from "./elevenlabs.js";
import type { TtsProvider } from "./provider.js";

/** The providers `voice.provider` may name in `marketing.json` (the schema's enum). */
export type TtsProviderId = MarketingConfig["voice"]["provider"];

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
