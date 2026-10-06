import { describe, expect, it } from "vitest";

import { createElevenLabsProvider } from "./elevenlabs.js";
import type { TtsInput } from "./provider.js";

const KEY = "test-key-123";
const input: TtsInput = { text: "One two.", voiceId: "voice id", model: "m1", language: "pl" };

function alignmentBody(text: string) {
  const characters = [...text];
  return {
    audio_base64: Buffer.from("mp3 bytes").toString("base64"),
    alignment: {
      characters,
      character_start_times_seconds: characters.map((_, i) => i * 0.1),
      character_end_times_seconds: characters.map((_, i) => i * 0.1 + 0.05),
    },
  };
}

interface Sent {
  url: string;
  init: RequestInit | undefined;
}

function fakeFetch(respond: () => Response | Promise<Response>) {
  const sent: Sent[] = [];
  const fetch: typeof globalThis.fetch = (url, init) => {
    sent.push({ url: typeof url === "string" ? url : "(not a string)", init });
    return Promise.resolve(respond());
  };
  return { sent, fetch };
}

describe("createElevenLabsProvider", () => {
  it("posts the text, model and language with the key header to the voice's with-timestamps endpoint", async () => {
    const { sent, fetch } = fakeFetch(() => Response.json(alignmentBody(input.text)));
    await createElevenLabsProvider({ apiKey: KEY, fetch }).synthesize(input);
    expect(sent).toHaveLength(1);
    expect(sent[0]?.url).toBe("https://api.elevenlabs.io/v1/text-to-speech/voice%20id/with-timestamps?output_format=mp3_44100_128");
    expect(sent[0]?.init?.method).toBe("POST");
    expect(sent[0]?.init?.headers).toEqual({ "xi-api-key": KEY, "Content-Type": "application/json" });
    expect(JSON.parse(sent[0]?.init?.body as string)).toMatchObject({ text: "One two.", model_id: "m1", language_code: "pl" });
  });

  it("returns the audio bytes and the words timed from the alignment", async () => {
    const { fetch } = fakeFetch(() => Response.json(alignmentBody(input.text)));
    const result = await createElevenLabsProvider({ apiKey: KEY, fetch }).synthesize(input);
    expect(result).toEqual({
      ok: true,
      value: {
        audio: Buffer.from("mp3 bytes"),
        words: [
          { text: "One", start: 0, end: 0.25 },
          { text: "two.", start: 0.4, end: 0.75 },
        ],
        charged: null,
      },
    });
  });

  it.each([
    ["a whole number", "3", 3],
    ["a fraction", "3.5", 3.5],
    ["zero", "0", 0],
    ["no header", null, null],
    ["an empty header", "", null],
    ["a word", "free", null],
    ["a negative number", "-4", null],
  ])("reads the charge from the character-cost header: %s", async (_label, header, charged) => {
    const headers: Record<string, string> = header === null ? {} : { "character-cost": header };
    const { fetch } = fakeFetch(() => Response.json(alignmentBody(input.text), { headers }));
    const result = await createElevenLabsProvider({ apiKey: KEY, fetch }).synthesize(input);
    expect(result.ok ? result.value.charged : "failed").toBe(charged);
  });

  it("fails without a key and sends nothing", async () => {
    const { sent, fetch } = fakeFetch(() => Response.json({}));
    for (const apiKey of [undefined, ""]) {
      expect(await createElevenLabsProvider({ apiKey, fetch }).synthesize(input)).toEqual({
        ok: false,
        error: "no ELEVENLABS_API_KEY in the environment.",
      });
    }
    expect(sent).toHaveLength(0);
  });

  it.each([
    ["a failed connection", () => Promise.reject(new Error("offline")), /^ElevenLabs: the connection failed \(Error: offline\)\.$/],
    ["a 401 answer", () => new Response("invalid api key", { status: 401 }), /^ElevenLabs answered 401 for voice voice id: invalid api key$/],
    ["a body that is not JSON", () => new Response("<html>"), /^ElevenLabs: the response is not JSON/],
    ["a body without timestamps", () => Response.json({ audio_base64: "AAAA" }), /no timestamps/],
  ])("returns an error for %s and never shows the key", async (_label, respond, message) => {
    const { fetch } = fakeFetch(respond);
    const result = await createElevenLabsProvider({ apiKey: KEY, fetch }).synthesize(input);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(message);
    expect(result.error).not.toContain(KEY);
  });

  it("cuts a long error body to 300 characters", async () => {
    const { fetch } = fakeFetch(() => new Response("x".repeat(1000), { status: 500 }));
    const result = await createElevenLabsProvider({ apiKey: KEY, fetch }).synthesize(input);
    expect(result.ok ? "" : result.error).toBe(`ElevenLabs answered 500 for voice voice id: ${"x".repeat(300)}`);
  });

  it("estimates one credit per character at most, without a key", () => {
    expect(createElevenLabsProvider({ apiKey: undefined }).estimate(input)).toEqual({
      characters: 8,
      maxCost: 8,
      unit: "ElevenLabs credits",
    });
  });
});
