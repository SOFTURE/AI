import { describe, expect, expectTypeOf, it } from "vitest";
import { z } from "zod";
import { requestJson, type RequestJsonFormWriteOptions, type RequestJsonWriteOptions } from "@softure-ai/core";

const FILES_URL = "https://api.example.com/v1/files";

interface RecordedRequest {
  readonly url: string;
  readonly init: RequestInit;
}

function createFakeFetch(answer: () => Response = () => respondWith('{"id":"file_1"}')) {
  const requests: RecordedRequest[] = [];
  const fetch = (input: string | URL, init: RequestInit = {}): Promise<Response> => {
    requests.push({ url: input.toString(), init });
    return Promise.resolve(answer());
  };
  return { fetch, requests };
}

function respondWith(body: string | null, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(body, { status, headers: { "content-type": "application/json", ...headers } });
}

function sentRequest(requests: readonly RecordedRequest[]): RecordedRequest {
  const [request] = requests;
  if (request === undefined) throw new Error("test: no request was sent");
  return request;
}

/** What a real `fetch` would put on the wire: the body and the content type it adds when the caller set none. */
async function readSentForm(init: RequestInit): Promise<FormData> {
  const sent = new Response(init.body);
  const contentType = new Headers(init.headers).get("content-type") ?? sent.headers.get("content-type") ?? "";
  return new Response(await sent.text(), { headers: { "content-type": contentType } }).formData();
}

describe("requestJson: form (URLSearchParams)", () => {
  it("sends the fields URL-encoded with their content type, and reads the JSON answer", async () => {
    const { fetch, requests } = createFakeFetch();
    const form = new URLSearchParams({ grant_type: "client_credentials", scope: "read write" });

    const result = await requestJson({ fetch, url: FILES_URL, method: "POST", form, schema: z.object({ id: z.string() }) });

    expect(result).toEqual({ ok: true, value: { id: "file_1" } });
    const { init } = sentRequest(requests);
    expect(init.body).toBe(form);
    const headers = new Headers(init.headers);
    expect(headers.get("content-type")).toBe("application/x-www-form-urlencoded");
    expect(headers.get("accept")).toBe("application/json");
    expect(init.redirect).toBe("manual");
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(Object.fromEntries(await readSentForm(init))).toEqual({ grant_type: "client_credentials", scope: "read write" });
  });

  it("keeps the caller's own content type in any letter case", async () => {
    const { fetch, requests } = createFakeFetch();
    await requestJson({
      fetch,
      url: FILES_URL,
      method: "POST",
      form: new URLSearchParams({ a: "1" }),
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
    });
    expect(new Headers(sentRequest(requests).init.headers).get("content-type")).toBe("application/x-www-form-urlencoded;charset=UTF-8");
  });

  it("sends an empty form as an empty body", async () => {
    const { fetch, requests } = createFakeFetch();
    await requestJson({ fetch, url: FILES_URL, method: "POST", form: new URLSearchParams() });
    expect(await new Response(sentRequest(requests).init.body).text()).toBe("");
  });
});

describe("requestJson: form (FormData)", () => {
  it("sends the parts as they are and leaves the multipart content type to fetch", async () => {
    const { fetch, requests } = createFakeFetch();
    const form = new FormData();
    form.append("purpose", "invoice");
    form.append("file", new Blob(["%PDF-1.7"], { type: "application/pdf" }), "invoice-7.pdf");

    const result = await requestJson({ fetch, url: FILES_URL, method: "POST", form });

    expect(result).toEqual({ ok: true, value: { id: "file_1" } });
    const { init } = sentRequest(requests);
    expect(init.body).toBe(form);
    expect(new Headers(init.headers).has("content-type")).toBe(false);
    const sent = await readSentForm(init);
    expect(sent.get("purpose")).toBe("invoice");
    const file = sent.get("file");
    expect(file).toBeInstanceOf(File);
    expect(file instanceof File ? [file.name, file.type, file.size, await file.text()] : null).toEqual([
      "invoice-7.pdf",
      "application/pdf",
      8,
      "%PDF-1.7",
    ]);
  });

  it("drops a content type the caller set, since it cannot carry the boundary", async () => {
    const { fetch, requests } = createFakeFetch();
    const form = new FormData();
    form.append("a", "1");
    await requestJson({ fetch, url: FILES_URL, method: "PUT", form, headers: [["content-type", "multipart/form-data"]] });
    expect(new Headers(sentRequest(requests).init.headers).has("content-type")).toBe(false);
  });
});

describe("requestJson: a form write reads the answer like a JSON write", () => {
  const form = (): URLSearchParams => new URLSearchParams({ a: "1" });

  it("answers ok(undefined) for an empty answer, schema or not", async () => {
    const { fetch } = createFakeFetch(() => new Response(null, { status: 204 }));
    expect(await requestJson({ fetch, url: FILES_URL, method: "POST", form: form(), schema: z.object({ id: z.string() }) })).toEqual({
      ok: true,
      value: undefined,
    });
  });

  it("maps statuses to the same failure codes", async () => {
    const { fetch } = createFakeFetch(() => respondWith('{"error":"busy"}', 429, { "Retry-After": "30" }));
    expect(await requestJson({ fetch, url: FILES_URL, method: "POST", form: form() })).toEqual({
      ok: false,
      error: "core.http_rate_limited",
      status: 429,
      retryAfterSeconds: 30,
    });
  });

  it("sends the idempotency key and returns the requested headers", async () => {
    const { fetch, requests } = createFakeFetch(() => respondWith('{"id":"cs_1"}', 200, { "Request-Id": "req_9" }));
    const result = await requestJson({
      fetch,
      url: FILES_URL,
      method: "POST",
      form: form(),
      idempotencyKey: "order-42",
      readHeaders: ["request-id"],
    });
    expect(result).toEqual({ ok: true, value: { body: { id: "cs_1" }, headers: { "request-id": "req_9" } } });
    expect(new Headers(sentRequest(requests).init.headers).get("idempotency-key")).toBe("order-42");
  });

  it("gives up after the timeout while the upload is in flight", async () => {
    const fetch = (_input: string | URL, init: RequestInit): Promise<Response> =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => {
          reject(new Error(`aborted while sending ${FILES_URL}`));
        });
      });
    expect(await requestJson({ fetch, url: FILES_URL, method: "POST", form: form(), timeoutMs: 5 })).toEqual({
      ok: false,
      error: "core.http_unreachable",
      status: null,
    });
  });
});

describe("requestJson: body that JSON would turn into {}", () => {
  const formData = new FormData();
  formData.append("a", "1");
  const stream = new ReadableStream<Uint8Array>();

  it.each([
    ["a FormData", formData],
    ["a URLSearchParams", new URLSearchParams({ a: "1" })],
    ["a Blob", new Blob(["x"])],
    ["a File", new File(["x"], "x.txt")],
    ["an ArrayBuffer", new ArrayBuffer(4)],
    ["a typed array", new Uint8Array([1, 2])],
    ["a ReadableStream", stream],
  ])("throws a TypeError for %s before anything is sent", async (_name, body) => {
    const { fetch, requests } = createFakeFetch();
    await expect(requestJson({ fetch, url: FILES_URL, method: "POST", body })).rejects.toThrow(TypeError);
    await expect(requestJson({ fetch, url: FILES_URL, method: "POST", body })).rejects.toThrow(/requestJson: body .* use `form`/);
    expect(requests).toHaveLength(0);
  });

  it("still sends a plain object, an array, a string and null as JSON", async () => {
    const { fetch, requests } = createFakeFetch();
    for (const body of [{ a: 1 }, [1, 2], "text", null]) {
      await requestJson({ fetch, url: FILES_URL, method: "POST", body });
    }
    expect(requests.map((request) => request.init.body)).toEqual(['{"a":1}', "[1,2]", '"text"', "null"]);
  });
});

describe("requestJson: misuse of form", () => {
  it("throws when body and form are both given", async () => {
    const { fetch, requests } = createFakeFetch();
    const options = { fetch, url: FILES_URL, method: "POST", body: { a: 1 }, form: new URLSearchParams() } as unknown as RequestJsonWriteOptions;
    await expect(requestJson(options)).rejects.toThrow(new TypeError("requestJson: pass either body or form, not both"));
    expect(requests).toHaveLength(0);
  });

  it("throws for a form on a GET", async () => {
    const { fetch, requests } = createFakeFetch();
    const options = { fetch, url: FILES_URL, form: new URLSearchParams() } as unknown as RequestJsonWriteOptions;
    await expect(requestJson(options)).rejects.toThrow(new TypeError("requestJson: a GET carries no form"));
    expect(requests).toHaveLength(0);
  });

  it("throws for a form that is neither URLSearchParams nor FormData", async () => {
    const { fetch, requests } = createFakeFetch();
    const options = { fetch, url: FILES_URL, method: "POST", form: { a: "1" } } as unknown as RequestJsonWriteOptions;
    await expect(requestJson(options)).rejects.toThrow(new TypeError("requestJson: form must be a URLSearchParams or a FormData"));
    expect(requests).toHaveLength(0);
  });

  it("does not compile with body and form together, or a form on a GET", () => {
    expectTypeOf<RequestJsonFormWriteOptions["body"]>().toEqualTypeOf<undefined>();
    expectTypeOf<{ url: string; method: "POST"; form: URLSearchParams }>().toMatchTypeOf<RequestJsonWriteOptions>();
    expectTypeOf<{ url: string; method: "POST"; form: URLSearchParams; body: object }>().not.toMatchTypeOf<RequestJsonWriteOptions>();
    // Never called: only the compiler reads these.
    const misuses = (): unknown[] => [
      // @ts-expect-error a GET carries no form
      requestJson({ url: FILES_URL, form: new URLSearchParams() }),
      // @ts-expect-error body and form exclude each other
      requestJson({ url: FILES_URL, method: "POST", body: {}, form: new FormData() }),
    ];
    expect(typeof misuses).toBe("function");
  });
});
