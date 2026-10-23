// requestWithConnection with a form body (#676): the form reaches the provider as it is, beside the credential, and
// the retry after a refreshed OAuth token sends the same form again.
import { requestWithConnection, saveCredential } from "@softure-ai/connections/server";
import type { FetchFunction } from "@softure-ai/core";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { connectFake } from "./connect.js";
import { ADMIN, createTestConnections, type TestConnections } from "./support.js";

const API = "https://api.example.test/files";

interface SentCall {
  readonly authorization: string | null;
  readonly contentType: string | null;
  readonly body: RequestInit["body"];
}

/** A fetch that records what each call sent and answers the given responses in order (the last one repeats). */
function createSentFetch(...answers: (() => Response)[]): { fetch: FetchFunction; calls: SentCall[] } {
  const calls: SentCall[] = [];
  const fetch: FetchFunction = (_input, init) => {
    const headers = new Headers(init.headers);
    calls.push({ authorization: headers.get("authorization"), contentType: headers.get("content-type"), body: init.body });
    const answer = answers[Math.min(calls.length - 1, answers.length - 1)];
    if (answer === undefined) throw new Error("test: no answer");
    return Promise.resolve(answer());
  };
  return { fetch, calls };
}

const answer = (status: number, body: unknown) => () => new Response(JSON.stringify(body), { status });

describe("requestWithConnection with a form", () => {
  let test: TestConnections;

  afterEach(async () => {
    await test.database.close();
  });

  it("sends a URL-encoded form with the stored key and reads the JSON answer", async () => {
    test = await createTestConnections();
    await saveCredential(test.ctx, { provider: "raindrop", credential: { kind: "api_key", apiKey: "rd-key" }, actorId: ADMIN });
    const api = createSentFetch(answer(200, { id: "f_1" }));
    const form = new URLSearchParams({ title: "a" });

    const result = await requestWithConnection(test.ctx, { provider: "raindrop" }, { url: API, fetch: api.fetch, method: "POST", form, schema: z.object({ id: z.string() }) });

    expect(result).toEqual({ ok: true, value: { id: "f_1" } });
    expect(api.calls).toEqual([{ authorization: "Bearer rd-key", contentType: "application/x-www-form-urlencoded", body: form }]);
  });

  it("sends the same multipart form again after refreshing a refused OAuth token", async () => {
    test = await createTestConnections();
    await connectFake(test);
    const api = createSentFetch(answer(401, { error: "expired" }), answer(201, { id: "f_2" }));
    const form = new FormData();
    form.append("file", new Blob(["%PDF-1.7"], { type: "application/pdf" }), "invoice.pdf");

    const result = await requestWithConnection(test.ctx, { provider: "fake" }, { url: API, fetch: api.fetch, method: "POST", form, headers: { "content-type": "multipart/form-data" } });

    expect(result).toEqual({ ok: true, value: { id: "f_2" } });
    expect(test.fake.calls.refresh).toBe(1);
    expect(api.calls).toHaveLength(2);
    expect(api.calls.map((call) => [call.body, call.contentType])).toEqual([
      [form, null],
      [form, null],
    ]);
    expect(api.calls[0]?.authorization).not.toBe(api.calls[1]?.authorization);
  });
});
