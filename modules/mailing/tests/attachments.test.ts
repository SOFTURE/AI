// Attachments: what reaches the provider, the limits checked before sending, the log line without names or bytes,
// the Resend body, the outbox round trip, the options and the dry-run preview.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  DEFAULT_ATTACHMENT_CONTENT_TYPES,
  describeAttachments,
  mailing,
  MAX_ATTACHMENT_BYTES,
  resend,
  type MailAttachment,
  type MailProvider,
  type ProviderMessage,
} from "@softure-ai/mailing";
import { formatMailPreview, previewMail, sendMail, validateMail } from "@softure-ai/mailing/server";
import { fakeMailProvider, readMailOutbox } from "@softure-ai/mailing/testing";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { createConfig, FROM, MAIL, REPLY_TO } from "./support.js";

const PDF: MailAttachment = { filename: "invoice-2026-10.pdf", contentType: "application/pdf", content: new TextEncoder().encode("%PDF-1.7 invoice") };
const CSV: MailAttachment = { filename: "Report Ada Lovelace.csv", contentType: "text/csv; charset=utf-8", content: new TextEncoder().encode("a,b\n1,2\n") };

/** A provider that records what it was given and accepts every mail. */
function createProvider(options: { readonly supportsAttachments?: boolean } = {}) {
  const calls: ProviderMessage[] = [];
  const provider: MailProvider = {
    name: "stub",
    ...options,
    send: (message) => {
      calls.push(message);
      return Promise.resolve({ status: "sent", id: "msg_1" });
    },
  };
  return { provider, calls };
}

function bytes(size: number): Uint8Array {
  return new Uint8Array(size).fill(7);
}

describe("sendMail with attachments", () => {
  let log: MockInstance<typeof console.error>;
  const logged = () => log.mock.calls.map((call) => call.join(" ")).join("\n");

  beforeEach(() => {
    log = vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => {
    log.mockRestore();
  });

  it("hands the provider every attachment with its filename, content type and the same bytes", async () => {
    const { provider, calls } = createProvider({ supportsAttachments: true });
    const result = await sendMail({ config: createConfig(provider) }, { ...MAIL, attachments: [PDF, CSV] });
    expect(result).toEqual({ ok: true, value: { id: "msg_1", provider: "stub" } });
    expect(calls).toEqual([
      { ...MAIL, from: FROM, replyTo: REPLY_TO, html: null, headers: {}, idempotencyKey: null, attachments: [PDF, { ...CSV, contentType: "text/csv; charset=utf-8" }] },
    ]);
  });

  it("leaves attachments out of the provider message when the mail has none, also for an empty list", async () => {
    const { provider, calls } = createProvider();
    await sendMail({ config: createConfig(provider) }, MAIL);
    await sendMail({ config: createConfig(provider) }, { ...MAIL, attachments: [] });
    expect(calls.map((call) => Object.hasOwn(call, "attachments"))).toEqual([false, false]);
  });

  it("refuses attachments for a provider that does not declare it delivers them, and logs no filename", async () => {
    const { provider, calls } = createProvider();
    const result = await sendMail({ config: createConfig(provider) }, { ...MAIL, attachments: [PDF] });
    expect(result).toEqual({ ok: false, error: "mailing.invalid_input" });
    expect(calls).toEqual([]);
    expect(logged()).toBe("mailing: send failed provider=stub reason=invalid_input status=none fields=attachments cause=provider_without_attachments attachments=application/pdf:16");
  });

  it("logs a provider failure with the attachments' content types and sizes, never their names or bytes", async () => {
    const provider = fakeMailProvider({ respond: () => ({ status: "rejected", httpStatus: 422 }) });
    await sendMail({ config: createConfig(provider) }, { ...MAIL, attachments: [PDF, CSV] });
    expect(logged()).toBe("mailing: send failed provider=fake reason=rejected status=422 attachments=application/pdf:16,text/csv:8");
    expect(logged()).not.toContain("invoice");
    expect(logged()).not.toContain("Ada");
  });

  it("sends exactly maxCount attachments and maxTotalBytes in all", async () => {
    const { provider, calls } = createProvider({ supportsAttachments: true });
    const config = createConfig(provider, { attachments: { maxCount: 2, maxTotalBytes: 100 } });
    const attachments = [
      { ...PDF, content: bytes(60) },
      { ...PDF, filename: "b.pdf", content: bytes(40) },
    ];
    expect((await sendMail({ config }, { ...MAIL, attachments })).ok).toBe(true);
    expect(calls).toHaveLength(1);
  });

  it.each<[string, readonly MailAttachment[]]>([
    ["one file past maxCount", [PDF, PDF, PDF]],
    ["one byte past maxTotalBytes", [{ ...PDF, content: bytes(60) }, { ...PDF, content: bytes(41) }]],
    ["empty content", [{ ...PDF, content: new Uint8Array(0) }]],
    ["content that is not bytes", [{ ...PDF, content: "%PDF" as unknown as Uint8Array }]],
    ["an empty filename", [{ ...PDF, filename: "" }]],
    ["a blank filename", [{ ...PDF, filename: "   " }]],
    ["a filename with a slash", [{ ...PDF, filename: "../etc/passwd" }]],
    ["a filename with a backslash", [{ ...PDF, filename: "C:\\invoice.pdf" }]],
    ["a filename with a line break", [{ ...PDF, filename: "invoice\r\n.pdf" }]],
    ["a filename with a NUL", [{ ...PDF, filename: "invoice\u0000.pdf" }]],
    ["a filename with DEL", [{ ...PDF, filename: "invoice\u007f.pdf" }]],
    ["the filename ..", [{ ...PDF, filename: ".." }]],
    ["a 256-character filename", [{ ...PDF, filename: `${"a".repeat(252)}.pdf` }]],
    ["a content type outside the allow-list", [{ ...PDF, contentType: "text/html" }]],
    ["a malformed content type", [{ ...PDF, contentType: "pdf" }]],
    ["a content type with a line break", [{ ...PDF, contentType: "application/pdf\r\nX-Evil: 1" }]],
  ])("refuses %s as invalid_input on attachments and sends nothing", async (_name, attachments) => {
    const { provider, calls } = createProvider({ supportsAttachments: true });
    const config = createConfig(provider, { attachments: { maxCount: 2, maxTotalBytes: 100 } });
    expect(await sendMail({ config }, { ...MAIL, attachments })).toEqual({ ok: false, error: "mailing.invalid_input" });
    expect(calls).toEqual([]);
    expect(logged()).toBe("mailing: send failed provider=stub reason=invalid_input status=none fields=attachments");
  });

  it("accepts a 255-character filename, a Buffer and a content type in another case", async () => {
    const { provider, calls } = createProvider({ supportsAttachments: true });
    const attachment = { filename: `${"a".repeat(251)}.pdf`, contentType: "Application/PDF", content: Buffer.from("%PDF") };
    expect((await sendMail({ config: createConfig(provider) }, { ...MAIL, attachments: [attachment] })).ok).toBe(true);
    expect(calls[0]?.attachments?.[0]?.filename).toHaveLength(255);
  });

  it("takes the app's own allow-list instead of the default", async () => {
    const { provider } = createProvider({ supportsAttachments: true });
    const config = createConfig(provider, { attachments: { contentTypes: ["application/x-custom"] } });
    expect((await sendMail({ config }, { ...MAIL, attachments: [{ ...PDF, contentType: "application/x-custom" }] })).ok).toBe(true);
    expect(await sendMail({ config }, { ...MAIL, attachments: [PDF] })).toEqual({ ok: false, error: "mailing.invalid_input" });
  });
});

describe("attachment options", () => {
  it("defaults to 10 files, 28,000,000 bytes and the default allow-list", () => {
    const config = createConfig(fakeMailProvider());
    const options = config.modules.find((module) => module.manifest.id === "mailing")?.options as { attachments: unknown };
    expect(options.attachments).toEqual({ maxCount: 10, maxTotalBytes: MAX_ATTACHMENT_BYTES, contentTypes: [...DEFAULT_ATTACHMENT_CONTENT_TYPES] });
    expect(MAX_ATTACHMENT_BYTES).toBe(28_000_000);
    // Base64 on the wire stays under the 40 MB cap.
    expect(Math.ceil(MAX_ATTACHMENT_BYTES / 3) * 4).toBeLessThan(40_000_000);
  });

  it.each([
    [{ maxTotalBytes: MAX_ATTACHMENT_BYTES + 1 }],
    [{ maxTotalBytes: 0 }],
    [{ maxCount: 0 }],
    [{ maxCount: 101 }],
    [{ contentTypes: [] }],
    [{ contentTypes: ["pdf"] }],
  ])("refuses %j", (attachments) => {
    expect(() => mailing({ from: FROM, provider: fakeMailProvider(), attachments })).toThrow();
  });

  it("keeps an allow-list lowercase and without parameters", () => {
    const config = createConfig(fakeMailProvider(), { attachments: { contentTypes: ["Text/CSV; charset=utf-8", "text/csv"] } });
    const options = config.modules.find((module) => module.manifest.id === "mailing")?.options as { attachments: { contentTypes: unknown } };
    expect(options.attachments.contentTypes).toEqual(["text/csv"]);
  });
});

describe("validateMail", () => {
  it("returns the attachments, and an empty list for a mail without", () => {
    expect(validateMail({ ...MAIL, attachments: [PDF] })).toMatchObject({ ok: true, value: { attachments: [PDF] } });
    expect(validateMail(MAIL)).toMatchObject({ ok: true, value: { attachments: [] } });
  });

  it("checks against the limits it is given", () => {
    expect(validateMail({ ...MAIL, attachments: [PDF] }, {}, { maxCount: 1, maxTotalBytes: 15, contentTypes: ["application/pdf"] })).toEqual({ ok: false, fields: ["attachments"] });
  });
});

describe("describeAttachments", () => {
  it("gives filename, content type and size, never the bytes", () => {
    expect(describeAttachments([PDF, CSV])).toEqual([
      { filename: "invoice-2026-10.pdf", contentType: "application/pdf", size: 16 },
      { filename: "Report Ada Lovelace.csv", contentType: "text/csv; charset=utf-8", size: 8 },
    ]);
    expect(describeAttachments([])).toEqual([]);
  });
});

describe("previewMail with attachments", () => {
  it("renders the attachments the provider would get", () => {
    const preview = previewMail(createConfig(fakeMailProvider()), { ...MAIL, attachments: [PDF] });
    expect(preview).toMatchObject({ ok: true, value: { attachments: [PDF] } });
  });

  it("refuses attachments past the configured limits", () => {
    const config = createConfig(fakeMailProvider(), { attachments: { maxCount: 1 } });
    expect(previewMail(config, { ...MAIL, attachments: [PDF, PDF] })).toEqual({ ok: false, error: "mailing.invalid_input", fields: ["attachments"] });
  });
});

describe("resend() with attachments", () => {
  it("declares it delivers attachments and sends each as base64 with its content type", async () => {
    const bodies: unknown[] = [];
    const fetchImpl: typeof fetch = (_url, init) => {
      bodies.push(JSON.parse(init?.body as string));
      return Promise.resolve(new Response(JSON.stringify({ id: "re_1" }), { status: 200 }));
    };
    const provider = resend({ apiKey: "re_test", fetch: fetchImpl });
    expect(provider.supportsAttachments).toBe(true);
    // A view into a larger buffer: only its own bytes are sent.
    const backing = new TextEncoder().encode("xx%PDFyy");
    const view = backing.subarray(2, 6);
    const message: ProviderMessage = {
      from: FROM,
      to: MAIL.to,
      replyTo: null,
      subject: MAIL.subject,
      text: MAIL.text,
      html: null,
      headers: {},
      idempotencyKey: null,
      attachments: [{ ...PDF, content: view }, CSV],
    };
    await expect(provider.send(message, { signal: new AbortController().signal })).resolves.toEqual({ status: "sent", id: "re_1" });
    expect(bodies[0]).toMatchObject({
      attachments: [
        { filename: "invoice-2026-10.pdf", content: Buffer.from("%PDF").toString("base64"), content_type: "application/pdf" },
        { filename: "Report Ada Lovelace.csv", content: Buffer.from("a,b\n1,2\n").toString("base64"), content_type: "text/csv; charset=utf-8" },
      ],
    });
  });

  it("sends no attachments key for a mail without", async () => {
    const bodies: Record<string, unknown>[] = [];
    const fetchImpl: typeof fetch = (_url, init) => {
      bodies.push(JSON.parse(init?.body as string) as Record<string, unknown>);
      return Promise.resolve(new Response(JSON.stringify({ id: "re_1" }), { status: 200 }));
    };
    const message: ProviderMessage = { from: FROM, to: MAIL.to, replyTo: null, subject: MAIL.subject, text: MAIL.text, html: null, headers: {}, idempotencyKey: null };
    await resend({ apiKey: "re_test", fetch: fetchImpl }).send(message, { signal: new AbortController().signal });
    expect(Object.hasOwn(bodies[0] ?? {}, "attachments")).toBe(false);
  });
});

describe("fakeMailProvider with attachments", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "mailing-attachments-"));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("captures a copy of the bytes and round-trips them through the outbox file", async () => {
    const outboxFile = join(dir, "outbox.jsonl");
    const provider = fakeMailProvider({ outboxFile });
    const content = new Uint8Array([0, 1, 2, 255]);
    await sendMail({ config: createConfig(provider) }, { ...MAIL, attachments: [{ ...PDF, content }] });
    await sendMail({ config: createConfig(provider) }, MAIL);
    content[0] = 9;
    expect(provider.sent[0]?.attachments?.[0]?.content).toEqual(new Uint8Array([0, 1, 2, 255]));
    const outbox = await readMailOutbox(outboxFile);
    expect(outbox[0]?.attachments).toEqual([{ ...PDF, content: new Uint8Array([0, 1, 2, 255]) }]);
    expect(outbox[1]).toEqual(provider.sent[1]);
  });
});

describe("formatMailPreview with attachments", () => {
  it("lists them by filename, content type and size after the bodies, without their bytes", () => {
    const preview = previewMail(createConfig(fakeMailProvider()), { ...MAIL, attachments: [PDF, CSV] });
    if (!preview.ok) throw new Error("the preview failed");
    const lines = formatMailPreview(preview.value);
    expect(lines.slice(-4)).toEqual([
      "--- attachments ---",
      "invoice-2026-10.pdf (application/pdf, 16 bytes)",
      "Report Ada Lovelace.csv (text/csv; charset=utf-8, 8 bytes)",
      "--- end of preview ---",
    ]);
    expect(lines.join("\n")).not.toContain("%PDF");
  });

  it("prints no attachments section for a mail without", () => {
    const preview = previewMail(createConfig(fakeMailProvider()), MAIL);
    if (!preview.ok) throw new Error("the preview failed");
    expect(formatMailPreview(preview.value)).not.toContain("--- attachments ---");
  });
});
