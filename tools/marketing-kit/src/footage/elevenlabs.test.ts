import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { createElevenLabsFootageProviders, createElevenLabsIsolationProvider, createElevenLabsMusicProvider, createElevenLabsSttProvider, getMusicLengthMs, readScribeResponse } from "./elevenlabs.js";

const dir = mkdtempSync(join(tmpdir(), "footage-elevenlabs-"));
const audio = join(dir, "talk.mp3");
writeFileSync(audio, "mp3 bytes");
afterAll(() => rmSync(dir, { recursive: true, force: true }));

interface Sent {
  url: string;
  init: RequestInit | undefined;
}

function fakeFetch(respond: () => Response) {
  const sent: Sent[] = [];
  const fetch: typeof globalThis.fetch = (url, init) => {
    sent.push({ url: typeof url === "string" ? url : "(not a string)", init });
    return Promise.resolve(respond());
  };
  return { sent, fetch };
}

const form = (sent: Sent | undefined): FormData => sent?.init?.body as FormData;

describe("readScribeResponse", () => {
  it("keeps spoken words only, trimmed, with their times", () => {
    const body = {
      language_code: "pol",
      words: [
        { text: "Hello,", start: 0.12, end: 0.5, type: "word" },
        { text: " ", start: 0.5, end: 0.6, type: "spacing" },
        { text: "(laughter)", start: 0.6, end: 1, type: "audio_event" },
        { text: "yyy", start: 1.1, end: 1.6, type: "word" },
      ],
    };
    expect(readScribeResponse(body, "pl")).toEqual({
      ok: true,
      value: {
        language: "pol",
        words: [
          { text: "Hello,", start: 0.12, end: 0.5 },
          { text: "yyy", start: 1.1, end: 1.6 },
        ],
      },
    });
  });

  it("refuses a body without words", () => {
    expect(readScribeResponse({ text: "hi" }, "pl")).toEqual({ ok: false, error: "ElevenLabs speech to text: the response has no words list." });
  });
});

describe("ElevenLabs footage providers", () => {
  it("sends the clip to Scribe with the model, language and word timestamps", async () => {
    const { sent, fetch } = fakeFetch(() => Response.json({ words: [{ text: "Hej", start: 0, end: 0.4, type: "word" }] }));
    const result = await createElevenLabsSttProvider({ apiKey: "key", fetch }).transcribe({ audio, language: "pl" });
    expect(result).toEqual({ ok: true, value: { language: "pl", words: [{ text: "Hej", start: 0, end: 0.4 }] } });
    expect(sent[0]?.url).toBe("https://api.elevenlabs.io/v1/speech-to-text");
    expect(sent[0]?.init?.headers).toEqual({ "xi-api-key": "key" });
    const body = form(sent[0]);
    expect([body.get("model_id"), body.get("language_code"), body.get("timestamps_granularity"), body.get("tag_audio_events")]).toEqual(["scribe_v2", "pl", "word", "false"]);
    expect((body.get("file") as File).name).toBe("talk.mp3");
  });

  it("returns the cleaned voice of the isolator", async () => {
    const { sent, fetch } = fakeFetch(() => new Response("clean audio"));
    const result = await createElevenLabsIsolationProvider({ apiKey: "key", fetch }).isolate({ audio });
    expect(result).toEqual({ ok: true, value: Buffer.from("clean audio") });
    expect(sent[0]?.url).toBe("https://api.elevenlabs.io/v1/audio-isolation");
    expect(form(sent[0]).get("audio")).not.toBeNull();
  });

  it("asks Music for an instrumental of the film's length", async () => {
    const { sent, fetch } = fakeFetch(() => new Response("music"));
    await createElevenLabsMusicProvider({ apiKey: "key", fetch }).compose({ prompt: "calm piano", seconds: 12.34 });
    expect(sent[0]?.url).toBe("https://api.elevenlabs.io/v1/music?output_format=mp3_44100_128");
    expect(JSON.parse(sent[0]?.init?.body as string)).toEqual({ prompt: "calm piano", music_length_ms: 12340, model_id: "music_v1", force_instrumental: true });
  });

  it("sends the cut with its description and tags to Video to Music", async () => {
    const { sent, fetch } = fakeFetch(() => new Response("music"));
    await createElevenLabsMusicProvider({ apiKey: "key", fetch }).scoreVideo({ video: audio, description: "warm", tags: ["upbeat", "acoustic"] });
    expect(sent[0]?.url).toBe("https://api.elevenlabs.io/v1/music/video-to-music?output_format=mp3_44100_128");
    expect(form(sent[0]).getAll("tags")).toEqual(["upbeat", "acoustic"]);
    expect(form(sent[0]).get("description")).toBe("warm");
  });

  it("fails without a key, before any request", async () => {
    const { sent, fetch } = fakeFetch(() => new Response("never"));
    const { stt } = createElevenLabsFootageProviders({}, fetch);
    expect(await stt.transcribe({ audio, language: "pl" })).toEqual({ ok: false, error: "no ELEVENLABS_API_KEY in the environment." });
    expect(sent).toHaveLength(0);
  });

  it("names the service and the status of a refused call", async () => {
    const { fetch } = fakeFetch(() => new Response("quota exceeded", { status: 401 }));
    expect(await createElevenLabsIsolationProvider({ apiKey: "key", fetch }).isolate({ audio })).toEqual({ ok: false, error: "ElevenLabs voice isolation answered 401: quota exceeded" });
  });

  it("clamps the music length to 3 s - 10 min", () => {
    expect([getMusicLengthMs(1), getMusicLengthMs(30.0001), getMusicLengthMs(900)]).toEqual([3000, 30001, 600000]);
  });
});
