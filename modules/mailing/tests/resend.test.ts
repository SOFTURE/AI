// The Resend adapter: the request it sends and how it reads each answer.
import { resend, RESEND_ENDPOINT, type ProviderMessage } from "@softure-ai/mailing";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";

const MESSAGE: ProviderMessage = {
  from: "Example <hello@mail.example.com>",
  to: "ada@example.org",
  replyTo: "support@example.com",
  subject: "Your weekly summary",
  text: "Hello Ada",
  html: "<p>Hello Ada</p>",
  headers: { "List-Unsubscribe": "<https://example.com/u>" },
  idempotencyKey: "summary:42",
};

interface Request {
  readonly url: string;
  readonly init: RequestInit;
}

/** The JSON body a request carried. */
function readBody(request: Request | undefined): unknown {
  const body = request?.init.body;
  return typeof body === "string" ? JSON.parse(body) : undefined;
}

/** A fetch that records requests and answers `status` with `body`. */
function createFetch(status: number, body: unknown) {
  const requests: Request[] = [];
  const fetchImpl: typeof fetch = (url, init) => {
    requests.push({ url: url instanceof URL ? url.href : typeof url === "string" ? url : url.url, init: init ?? {} });
    const text = typeof body === "string" ? body : JSON.stringify(body);
    return Promise.resolve(new Response(text, { status, headers: { "Content-Type": "application/json" } }));
  };
  return { fetch: fetchImpl, requests };
}

const signal = new AbortController().signal;

describe("resend()", () => {
  let log: MockInstance<typeof console.error>;

  beforeEach(() => {
    log = vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => {
    log.mockRestore();
    vi.unstubAllEnvs();
  });

  it("posts the mail to Resend's API with the key, the idempotency key and Resend's field names", async () => {
    const { fetch, requests } = createFetch(200, { id: "re_1" });
    await expect(resend({ apiKey: "re_key", fetch }).send(MESSAGE, { signal })).resolves.toEqual({ status: "sent", id: "re_1" });

    expect(requests).toHaveLength(1);
    const [request] = requests;
    expect(request?.url).toBe(RESEND_ENDPOINT);
    expect(request?.init.method).toBe("POST");
    expect(request?.init.signal).toBe(signal);
    expect(request?.init.headers).toEqual({ Authorization: "Bearer re_key", "Content-Type": "application/json", "Idempotency-Key": "summary:42" });
    expect(readBody(request)).toEqual({
      from: "Example <hello@mail.example.com>",
      to: ["ada@example.org"],
      subject: "Your weekly summary",
      text: "Hello Ada",
      html: "<p>Hello Ada</p>",
      reply_to: "support@example.com",
      headers: { "List-Unsubscribe": "<https://example.com/u>" },
    });
  });

  it("leaves out what the mail does not have", async () => {
    const { fetch, requests } = createFetch(200, { id: "re_2" });
    await resend({ apiKey: "re_key", fetch, endpoint: "https://mail-proxy.example.com/emails" }).send(
      { ...MESSAGE, replyTo: null, html: null, headers: {}, idempotencyKey: null },
      { signal },
    );
    expect(requests[0]?.url).toBe("https://mail-proxy.example.com/emails");
    expect(requests[0]?.init.headers).toEqual({ Authorization: "Bearer re_key", "Content-Type": "application/json" });
    expect(readBody(requests[0])).toEqual({ from: MESSAGE.from, to: [MESSAGE.to], subject: MESSAGE.subject, text: MESSAGE.text });
  });

  it("reads RESEND_API_KEY on every send", async () => {
    const { fetch, requests } = createFetch(200, { id: "re_3" });
    const provider = resend({ fetch });
    vi.stubEnv("RESEND_API_KEY", "re_first");
    await provider.send(MESSAGE, { signal });
    vi.stubEnv("RESEND_API_KEY", "re_second");
    await provider.send(MESSAGE, { signal });
    expect(requests.map((request) => (request.init.headers as Record<string, string>).Authorization)).toEqual(["Bearer re_first", "Bearer re_second"]);
  });

  it("answers unavailable without a key and says which variable to set", async () => {
    const { fetch, requests } = createFetch(200, { id: "never" });
    vi.stubEnv("RESEND_API_KEY", " ");
    await expect(resend({ fetch }).send(MESSAGE, { signal })).resolves.toEqual({ status: "unavailable" });
    expect(requests).toEqual([]);
    expect(log).toHaveBeenCalledWith("mailing: resend has no API key; set RESEND_API_KEY or pass resend({ apiKey })");
  });

  it.each([
    [400, { name: "validation_error", message: "Invalid `to` field: ada@example.org" }, "rejected"],
    [401, { name: "missing_api_key" }, "rejected"],
    [403, { name: "invalid_api_key" }, "rejected"],
    [409, { name: "invalid_idempotent_request" }, "rejected"],
    [422, { name: "validation_error" }, "rejected"],
    [409, { name: "concurrent_idempotent_requests" }, "unavailable"],
    [408, "", "unavailable"],
    [429, { name: "rate_limit_exceeded" }, "unavailable"],
    [500, { name: "internal_server_error" }, "unavailable"],
    [503, "<html>down</html>", "unavailable"],
  ])("maps %i %j to %s", async (status, body, outcome) => {
    const { fetch } = createFetch(status, body);
    await expect(resend({ apiKey: "re_key", fetch }).send(MESSAGE, { signal })).resolves.toEqual({ status: outcome, httpStatus: status });
    expect(log).not.toHaveBeenCalled();
  });

  it.each([
    ["no id", {}],
    ["an empty id", { id: "" }],
    ["a body that is not JSON", "ok"],
  ])("answers unavailable for a success with %s", async (_case, body) => {
    const { fetch } = createFetch(200, body);
    await expect(resend({ apiKey: "re_key", fetch }).send(MESSAGE, { signal })).resolves.toEqual({ status: "unavailable", httpStatus: 200 });
  });

  it("lets a network failure through for sendMail to turn into unavailable", async () => {
    const fetch = (() => Promise.reject(new TypeError("fetch failed"))) as typeof globalThis.fetch;
    await expect(resend({ apiKey: "re_key", fetch }).send(MESSAGE, { signal })).rejects.toThrow("fetch failed");
  });
});
