// The share target's route: GET and POST shares, streamed files, the sign-in round trip and refusals (#959).
import { createShareTargetRoute, type SharedContent, type SharedFile } from "@softure-ai/pwa/next";
import { describe, expect, it, vi } from "vitest";

const ORIGIN = "http://app.test";
const DECODER = new TextDecoder();

interface Received {
  readonly url: string | null;
  readonly text: string | null;
  readonly title: string | null;
  readonly files: readonly { field: string; name: string; contentType: string; content: string }[];
}

async function readFile(file: SharedFile): Promise<string> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of file.body) chunks.push(chunk);
  return DECODER.decode(Buffer.concat(chunks));
}

/** A handle that records the share, reading every file, and answers `/jobs/1`. */
function recordingHandle(): { handle: (context: unknown, share: SharedContent) => Promise<string>; received: Received[] } {
  const received: Received[] = [];
  return {
    received,
    async handle(_context, share) {
      const files = [];
      for await (const file of share.files) files.push({ field: file.field, name: file.name, contentType: file.contentType, content: await readFile(file) });
      received.push({ url: share.url, text: share.text, title: share.title, files });
      return "/jobs/1";
    },
  };
}

const MEDIA_TARGET = { action: "/share", files: [{ name: "media", accept: ["image/*", ".pdf"] }] };

function postForm(form: FormData, path = "/share"): Request {
  return new Request(`${ORIGIN}${path}`, { method: "POST", body: form });
}

describe("createShareTargetRoute: GET", () => {
  it("hands the link found in text, the text and the title to handle and redirects where it answers", async () => {
    const { handle, received } = recordingHandle();
    const { GET } = createShareTargetRoute({ shareTarget: { action: "/share" }, handle });
    const response = await GET(new Request(`${ORIGIN}/share?title=Video&text=${encodeURIComponent("Watch https://youtu.be/x1.")}`));
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/jobs/1");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(received).toEqual([{ url: "https://youtu.be/x1", text: "Watch https://youtu.be/x1.", title: "Video", files: [] }]);
  });

  it("reads the app's field names and treats empty values as missing", async () => {
    const { handle, received } = recordingHandle();
    const { GET } = createShareTargetRoute({ shareTarget: { action: "/share", params: { url: "link", text: "body" } }, handle });
    await GET(new Request(`${ORIGIN}/share?link=https%3A%2F%2Fa.example%2F&body=&title=%20`));
    expect(received).toEqual([{ url: "https://a.example/", text: null, title: null, files: [] }]);
  });

  it("answers 413 for a field over maxFieldBytes", async () => {
    const handle = vi.fn(() => Promise.resolve("/"));
    const { GET } = createShareTargetRoute({ shareTarget: { action: "/share" }, handle, maxFieldBytes: 10 });
    expect((await GET(new Request(`${ORIGIN}/share?text=${"a".repeat(11)}`))).status).toBe(413);
    expect(handle).not.toHaveBeenCalled();
  });

  it("throws when handle answers a path on another origin", async () => {
    const { GET } = createShareTargetRoute({ shareTarget: { action: "/share" }, handle: () => Promise.resolve("//evil.example/") });
    await expect(GET(new Request(`${ORIGIN}/share?text=x`))).rejects.toThrow('the share handle must answer a same-origin path, got "//evil.example/"');
  });
});

describe("createShareTargetRoute: POST", () => {
  it("streams the accepted files to handle in order with the text fields", async () => {
    const { handle, received } = recordingHandle();
    const { POST } = createShareTargetRoute({ shareTarget: MEDIA_TARGET, handle });
    const form = new FormData();
    form.set("title", "Holiday");
    form.set("text", "https://photos.example/album/1");
    form.append("media", new File(["png-bytes"], "a.png", { type: "image/png" }));
    form.append("media", new File(["text"], "notes.txt", { type: "text/plain" }));
    form.append("other", new File(["x"], "b.png", { type: "image/png" }));
    form.append("media", new File(["%PDF"], "report.pdf", { type: "" }));
    const response = await POST(postForm(form));
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/jobs/1");
    expect(received).toEqual([
      {
        url: "https://photos.example/album/1",
        text: "https://photos.example/album/1",
        title: "Holiday",
        files: [
          { field: "media", name: "a.png", contentType: "image/png", content: "png-bytes" },
          { field: "media", name: "report.pdf", contentType: "application/octet-stream", content: "%PDF" },
        ],
      },
    ]);
  });

  it("skips the body of a file handle does not read", async () => {
    const names: string[] = [];
    const { POST } = createShareTargetRoute({
      shareTarget: MEDIA_TARGET,
      handle: async (_context, share) => {
        for await (const file of share.files) names.push(file.name);
        return "/done";
      },
    });
    const form = new FormData();
    for (const name of ["1.png", "2.png"]) form.append("media", new File([name.repeat(5000)], name, { type: "image/png" }));
    expect((await POST(postForm(form))).headers.get("location")).toBe("/done");
    expect(names).toEqual(["1.png", "2.png"]);
  });

  it("hands on at most maxFiles files", async () => {
    const { handle, received } = recordingHandle();
    const { POST } = createShareTargetRoute({ shareTarget: MEDIA_TARGET, handle, maxFiles: 2 });
    const form = new FormData();
    for (const name of ["1.png", "2.png", "3.png"]) form.append("media", new File([name], name, { type: "image/png" }));
    await POST(postForm(form));
    expect(received[0]?.files.map((file) => file.name)).toEqual(["1.png", "2.png"]);
  });

  it("cancels the rest of the body when handle stops early, its unread file included", async () => {
    let isCancelled = false;
    const form = new FormData();
    form.set("text", "hello");
    form.append("media", new File(["first"], "1.png", { type: "image/png" }));
    form.append("media", new File(["second"], "2.png", { type: "image/png" }));
    const source = postForm(form);
    const bytes = new Uint8Array(await source.arrayBuffer());
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes);
      },
      cancel() {
        isCancelled = true;
      },
    });
    const names: string[] = [];
    const { POST } = createShareTargetRoute({
      shareTarget: MEDIA_TARGET,
      handle: async (_context, share) => {
        for await (const file of share.files) {
          names.push(file.name);
          break;
        }
        return "/done";
      },
    });
    const request = new Request(`${ORIGIN}/share`, { method: "POST", body, headers: { "content-type": source.headers.get("content-type") ?? "" }, duplex: "half" } as RequestInit);
    const response = await POST(request);
    expect(response.headers.get("location")).toBe("/done");
    expect(names).toEqual(["1.png"]);
    expect(isCancelled).toBe(true);
  });

  it("answers 415 for a body that is not multipart/form-data", async () => {
    const { POST } = createShareTargetRoute({ shareTarget: MEDIA_TARGET, handle: () => Promise.resolve("/") });
    const request = new Request(`${ORIGIN}/share`, { method: "POST", body: "text=x", headers: { "content-type": "application/x-www-form-urlencoded" } });
    expect((await POST(request)).status).toBe(415);
  });

  it("answers 400 for a broken multipart body, also when handle is reading the files", async () => {
    const handle = vi.fn(async (_context: unknown, share: SharedContent) => {
      for await (const file of share.files) await readFile(file);
      return "/";
    });
    const { POST } = createShareTargetRoute({ shareTarget: MEDIA_TARGET, handle });
    const headers = { "content-type": "multipart/form-data; boundary=b" };
    const cut = `--b\r\nContent-Disposition: form-data; name="media"; filename="a.png"\r\nContent-Type: image/png\r\n\r\nbytes without an end`;
    expect((await POST(new Request(`${ORIGIN}/share`, { method: "POST", body: cut, headers }))).status).toBe(400);
    expect(handle).toHaveBeenCalledTimes(1);
    expect((await POST(new Request(`${ORIGIN}/share`, { method: "POST", body: "garbage", headers }))).status).toBe(400);
  });

  it("answers 413 for a text field over maxFieldBytes", async () => {
    const handle = vi.fn(() => Promise.resolve("/"));
    const { POST } = createShareTargetRoute({ shareTarget: MEDIA_TARGET, handle, maxFieldBytes: 4 });
    const form = new FormData();
    form.set("text", "12345");
    expect((await POST(postForm(form))).status).toBe(413);
    expect(handle).not.toHaveBeenCalled();
  });

  it("reads only the text fields that come before the first file", async () => {
    const { handle, received } = recordingHandle();
    const { POST } = createShareTargetRoute({ shareTarget: MEDIA_TARGET, handle });
    const form = new FormData();
    form.append("media", new File(["a"], "a.png", { type: "image/png" }));
    form.set("text", "late");
    await POST(postForm(form));
    expect(received).toEqual([{ url: null, text: null, title: null, files: [{ field: "media", name: "a.png", contentType: "image/png", content: "a" }] }]);
  });
});

describe("createShareTargetRoute: signed in", () => {
  const user = { id: "u1" };

  it("passes the signed-in user and the request to handle", async () => {
    const handle = vi.fn(() => Promise.resolve("/jobs/2"));
    const { GET } = createShareTargetRoute({ shareTarget: { action: "/share" }, getUser: () => Promise.resolve(user), signInPath: "/login", handle });
    const request = new Request(`${ORIGIN}/share?url=https%3A%2F%2Fa.example%2F`);
    await GET(request);
    expect(handle).toHaveBeenCalledWith({ user, request }, expect.objectContaining({ url: "https://a.example/" }));
  });

  it("sends a signed-out GET share to sign-in with the share kept in next, and resumes it after sign-in", async () => {
    let current: { id: string } | null = null;
    const { handle, received } = recordingHandle();
    const { GET } = createShareTargetRoute({ shareTarget: { action: "/share" }, getUser: () => Promise.resolve(current), signInPath: "/login?source=share", handle });
    const shared = `${ORIGIN}/share?title=T&text=${encodeURIComponent("see https://a.example/x&y")}&url=`;
    const response = await GET(new Request(shared));
    expect(response.status).toBe(303);
    const location = new URL(response.headers.get("location") ?? "", ORIGIN);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("source")).toBe("share");
    const next = location.searchParams.get("next") ?? "";
    expect(next).toBe(`/share?text=${encodeURIComponent("see https://a.example/x&y").replaceAll("%20", "+")}&title=T`);
    expect(received).toEqual([]);

    current = user;
    expect((await GET(new Request(`${ORIGIN}${next}`))).headers.get("location")).toBe("/jobs/1");
    expect(received).toEqual([{ url: "https://a.example/x&y", text: "see https://a.example/x&y", title: "T", files: [] }]);
  });

  it("keeps the link and text of a signed-out POST share, not its files, under the app's return parameter", async () => {
    const handle = vi.fn(() => Promise.resolve("/"));
    const { POST } = createShareTargetRoute({ shareTarget: MEDIA_TARGET, getUser: () => Promise.resolve(null), signInPath: "/sign-in", returnParam: "returnTo", handle });
    const form = new FormData();
    form.set("url", "https://a.example/");
    form.append("media", new File(["a"], "a.png", { type: "image/png" }));
    const response = await POST(postForm(form));
    expect(response.headers.get("location")).toBe(`/sign-in?returnTo=${encodeURIComponent("/share?url=https%3A%2F%2Fa.example%2F")}`);
    expect(handle).not.toHaveBeenCalled();
  });

  it("sends a signed-out share without fields to the action itself", async () => {
    const { GET } = createShareTargetRoute({ shareTarget: { action: "/share" }, getUser: () => Promise.resolve(null), signInPath: "/login", handle: () => Promise.resolve("/") });
    expect((await GET(new Request(`${ORIGIN}/share`))).headers.get("location")).toBe("/login?next=%2Fshare");
  });

  it("refuses wrong options when it loads", () => {
    const handle = (): Promise<string> => Promise.resolve("/");
    expect(() => createShareTargetRoute({ shareTarget: { action: "/share" }, getUser: () => Promise.resolve(null), signInPath: "https://login.example", handle })).toThrow(
      'signInPath must be a same-origin path, got "https://login.example"',
    );
    expect(() => createShareTargetRoute({ shareTarget: { action: "/share" }, handle, maxFiles: 0 })).toThrow("maxFiles must be a positive integer, got 0");
    expect(() => createShareTargetRoute({ shareTarget: { action: "/share" }, handle, maxFieldBytes: 1.5 })).toThrow("maxFieldBytes must be a positive integer, got 1.5");
  });
});
