import { describe, expect, it } from "vitest";

import { createTtsProvider } from "./providers.js";

describe("createTtsProvider", () => {
  it("builds the ElevenLabs adapter with the key from the given environment", async () => {
    const sent: string[] = [];
    const fetch = ((url: string, init?: RequestInit) => {
      sent.push(String((init?.headers as Record<string, string>)["xi-api-key"]));
      return Promise.resolve(new Response("nope", { status: 401 }));
    }) as typeof globalThis.fetch;
    const provider = createTtsProvider("elevenlabs", { env: { ELEVENLABS_API_KEY: "k" }, fetch });
    expect(provider.id).toBe("elevenlabs");
    await provider.synthesize({ text: "a", voiceId: "v", model: "m", language: "en" });
    expect(sent).toEqual(["k"]);
  });
});
