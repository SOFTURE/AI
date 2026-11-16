// A provider that sends nothing: it captures mail in memory (`provider.sent`) and, with an outbox,
// hands each mail as one JSON line to a test in another process (an e2e against `next start`),
// attachment bytes as base64. The outbox is a file the server appends to (Node), or a URL each line is
// POSTed to (a host without a shared disk, such as Cloudflare Workers, whose test runs a small sink that
// appends what it receives to the file `readMailOutbox` reads). It honours idempotency keys like a real provider: a repeated key answers the
// first id and captures nothing new.
import { appendFile } from "node:fs/promises";
import type { MailProvider, ProviderMessage, ProviderOutcome } from "../contract.js";

/** A captured mail: what the provider received, with the id it answered. */
export interface CapturedMail extends ProviderMessage {
  readonly id: string;
}

export interface FakeMailProviderOptions {
  /** A file to append each captured mail to, as one JSON line (`readMailOutbox` reads it). */
  readonly outboxFile?: string;
  /** A URL to POST each captured mail to, as one JSON line (`application/json`); for hosts without a shared disk. */
  readonly outboxUrl?: string;
  /**
   * Decides the outcome per mail, to test failure handling. Return `undefined` (or omit the
   * option) to accept the mail.
   */
  readonly respond?: (message: ProviderMessage) => Exclude<ProviderOutcome, { status: "sent" }> | undefined;
}

export interface FakeMailProvider extends MailProvider {
  /** Every mail accepted so far, oldest first. */
  readonly sent: readonly CapturedMail[];
  /** Forgets the captured mail and the idempotency keys. */
  clear(): void;
}

export function fakeMailProvider(options: FakeMailProviderOptions = {}): FakeMailProvider {
  const sent: CapturedMail[] = [];
  const idsByKey = new Map<string, string>();
  let counter = 0;

  return {
    name: "fake",
    supportsAttachments: true,
    get sent() {
      return [...sent];
    },
    clear() {
      sent.length = 0;
      idsByKey.clear();
    },
    async send(message) {
      if (options.outboxFile === undefined && options.outboxUrl === undefined && process.env.NODE_ENV === "production") {
        // In memory, production mail would vanish without a trace.
        console.error("mailing: fakeMailProvider() refuses to run in production without an outboxFile or outboxUrl; configure a real provider");
        return { status: "unavailable" };
      }
      const refusal = options.respond?.(message);
      if (refusal !== undefined) return refusal;

      const knownId = message.idempotencyKey === null ? undefined : idsByKey.get(message.idempotencyKey);
      if (knownId !== undefined) return { status: "sent", id: knownId };

      counter += 1;
      const captured: CapturedMail = {
        ...message,
        headers: { ...message.headers },
        ...(message.attachments === undefined ? {} : { attachments: message.attachments.map((attachment) => ({ ...attachment, content: attachment.content.slice() })) }),
        id: `fake-${String(counter)}-${crypto.randomUUID()}`,
      };
      if (options.outboxFile !== undefined) {
        await appendFile(options.outboxFile, `${JSON.stringify(toOutboxLine(captured))}\n`, "utf8");
      }
      if (options.outboxUrl !== undefined) {
        const posted = await postOutboxLine(options.outboxUrl, toOutboxLine(captured));
        if (!posted) return { status: "unavailable" };
      }
      sent.push(captured);
      if (message.idempotencyKey !== null) idsByKey.set(message.idempotencyKey, captured.id);
      return { status: "sent", id: captured.id };
    },
  };
}

/** A captured mail as one outbox line: attachment bytes as base64 (`readMailOutbox` decodes them). */
function toOutboxLine(mail: CapturedMail): unknown {
  if (mail.attachments === undefined) return mail;
  return {
    ...mail,
    attachments: mail.attachments.map((attachment) => ({ ...attachment, content: Buffer.from(attachment.content).toString("base64") })),
  };
}

/** POSTs one outbox line; false when the sink did not take it, so the mail counts as not sent. */
async function postOutboxLine(url: string, line: unknown): Promise<boolean> {
  try {
    const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(line) });
    return response.ok;
  } catch (error) {
    console.error(`mailing: fakeMailProvider() could not post to its outboxUrl: ${error instanceof Error ? error.name : "unknown error"}`);
    return false;
  }
}
