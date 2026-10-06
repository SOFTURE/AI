import { err, ok, type TtsEstimate, type TtsInput, type TtsProvider, type TtsRecording, type TtsResult } from "./provider.js";
import { buildTtsRequest, readTimestampsResponse, wordsFromAlignment } from "./voiceover.js";

export const ELEVENLABS_PROVIDER_ID = "elevenlabs";
export const ELEVENLABS_API_KEY_ENV = "ELEVENLABS_API_KEY";
const ERROR_DETAIL_LENGTH = 300;
/** The response header with the credits the generation cost (API reference, "Response headers"). */
const CHARGE_HEADER = "character-cost";

export interface ElevenLabsOptions {
  /** The API key; a missing one fails `synthesize`, not the estimate. */
  apiKey: string | undefined;
  /** Injected in tests so no request reaches the network. */
  fetch?: typeof globalThis.fetch;
}

/**
 * ElevenLabs bills text to speech per input character: at most one credit each, less on API plans
 * with a discount. The estimate is that upper bound.
 */
function estimate(input: TtsInput): TtsEstimate {
  return { characters: input.text.length, maxCost: input.text.length, unit: "ElevenLabs credits" };
}

/** The credits ElevenLabs reports for the call; null when the header is missing or not a non-negative number. */
function readCharge(response: Response): number | null {
  const header = response.headers.get(CHARGE_HEADER)?.trim() ?? "";
  if (header.length === 0) return null;
  const charged = Number(header);
  return Number.isFinite(charged) && charged >= 0 ? charged : null;
}

async function readBody(response: Response): Promise<TtsResult<unknown>> {
  try {
    return ok((await response.json()) as unknown);
  } catch (error) {
    return err(`ElevenLabs: the response is not JSON (${String(error)}).`);
  }
}

/** The ElevenLabs `with-timestamps` endpoint behind the `TtsProvider` interface. */
export function createElevenLabsProvider(options: ElevenLabsOptions): TtsProvider {
  const send = options.fetch ?? globalThis.fetch;

  async function synthesize(input: TtsInput): Promise<TtsResult<TtsRecording>> {
    if (options.apiKey === undefined || options.apiKey.length === 0) {
      return err(`no ${ELEVENLABS_API_KEY_ENV} in the environment.`);
    }
    const request = buildTtsRequest(input.text, input.voiceId, input.model, input.language);
    let response: Response;
    try {
      response = await send(request.url, {
        method: "POST",
        headers: { "xi-api-key": options.apiKey, "Content-Type": "application/json" },
        body: JSON.stringify(request.body),
      });
    } catch (error) {
      return err(`ElevenLabs: the connection failed (${String(error)}).`);
    }
    if (!response.ok) {
      const detail = await response.text().catch((error: unknown) => `(unreadable body: ${String(error)})`);
      return err(`ElevenLabs answered ${response.status} for voice ${input.voiceId}: ${detail.slice(0, ERROR_DETAIL_LENGTH)}`);
    }
    const body = await readBody(response);
    if (!body.ok) return body;
    try {
      const parsed = readTimestampsResponse(body.value);
      return ok({ audio: parsed.audio, words: wordsFromAlignment(parsed.alignment), charged: readCharge(response) });
    } catch (error) {
      // The parsers throw on a malformed body; for a caller it is an expected failure of the call.
      return err(error instanceof Error ? error.message : String(error));
    }
  }

  return { id: ELEVENLABS_PROVIDER_ID, estimate, synthesize };
}
