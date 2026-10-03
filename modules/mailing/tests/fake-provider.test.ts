// The fake provider: captures in memory and in an outbox file, honours idempotency keys, refuses
// production without an outbox.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ProviderMessage } from "@softure-ai/mailing";
import { fakeMailProvider, readMailOutbox } from "@softure-ai/mailing/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const MESSAGE: ProviderMessage = {
  from: "hello@mail.example.com",
  to: "ada@example.org",
  replyTo: null,
  subject: "Hello",
  text: "Hello Ada",
  html: null,
  headers: {},
  idempotencyKey: null,
};

const signal = new AbortController().signal;

describe("fakeMailProvider()", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "softure-mailing-"));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("captures each mail in memory with a fresh id", async () => {
    const provider = fakeMailProvider();
    const first = await provider.send(MESSAGE, { signal });
    const second = await provider.send({ ...MESSAGE, to: "eve@example.org" }, { signal });
    expect(provider.sent.map((mail) => mail.to)).toEqual(["ada@example.org", "eve@example.org"]);
    expect(first).toEqual({ status: "sent", id: provider.sent[0]?.id });
    expect(second).toEqual({ status: "sent", id: provider.sent[1]?.id });
    expect(provider.sent[0]?.id).not.toBe(provider.sent[1]?.id);
    expect(provider.sent[0]).toEqual({ ...MESSAGE, id: provider.sent[0]?.id });
  });

  it("answers the first id for a repeated idempotency key and captures nothing new", async () => {
    const provider = fakeMailProvider();
    const first = await provider.send({ ...MESSAGE, idempotencyKey: "k1" }, { signal });
    const repeat = await provider.send({ ...MESSAGE, idempotencyKey: "k1" }, { signal });
    await provider.send({ ...MESSAGE, idempotencyKey: "k2" }, { signal });
    expect(repeat).toEqual(first);
    expect(provider.sent.map((mail) => mail.idempotencyKey)).toEqual(["k1", "k2"]);
  });

  it("forgets mail and keys on clear()", async () => {
    const provider = fakeMailProvider();
    await provider.send({ ...MESSAGE, idempotencyKey: "k1" }, { signal });
    provider.clear();
    expect(provider.sent).toEqual([]);
    await provider.send({ ...MESSAGE, idempotencyKey: "k1" }, { signal });
    expect(provider.sent).toHaveLength(1);
  });

  it("answers the outcome respond() picks, capturing nothing", async () => {
    const provider = fakeMailProvider({ respond: (message) => (message.to === "eve@example.org" ? { status: "rejected", httpStatus: 422 } : undefined) });
    await expect(provider.send({ ...MESSAGE, to: "eve@example.org" }, { signal })).resolves.toEqual({ status: "rejected", httpStatus: 422 });
    await expect(provider.send(MESSAGE, { signal })).resolves.toMatchObject({ status: "sent" });
    expect(provider.sent.map((mail) => mail.to)).toEqual(["ada@example.org"]);
  });

  it("appends each mail to the outbox file, which readMailOutbox reads back and filters", async () => {
    const outboxFile = join(dir, "outbox.jsonl");
    await expect(readMailOutbox(outboxFile)).resolves.toEqual([]);
    const provider = fakeMailProvider({ outboxFile });
    await provider.send({ ...MESSAGE, html: "<p>Hi</p>", headers: { "X-Tag": "a" }, idempotencyKey: "k1" }, { signal });
    await provider.send({ ...MESSAGE, to: "eve@example.org" }, { signal });
    await expect(readMailOutbox(outboxFile)).resolves.toEqual(provider.sent);
    await expect(readMailOutbox(outboxFile, { to: "eve@example.org" })).resolves.toEqual([provider.sent[1]]);
  });

  it("refuses to run in production without an outbox file, since mail would vanish", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubEnv("NODE_ENV", "production");
    const provider = fakeMailProvider();
    await expect(provider.send(MESSAGE, { signal })).resolves.toEqual({ status: "unavailable" });
    expect(provider.sent).toEqual([]);
    expect(log).toHaveBeenCalledWith("mailing: fakeMailProvider() refuses to run in production without an outboxFile; configure a real provider");

    const withOutbox = fakeMailProvider({ outboxFile: join(dir, "outbox.jsonl") });
    await expect(withOutbox.send(MESSAGE, { signal })).resolves.toMatchObject({ status: "sent" });
  });
});
