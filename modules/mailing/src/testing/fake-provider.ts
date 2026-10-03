// A provider that sends nothing: it captures mail in memory (`provider.sent`) and, with an outbox
// file, appends each mail as one JSON line for a test in another process (an e2e against
// `next start`). It honours idempotency keys like a real provider: a repeated key answers the
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
    get sent() {
      return [...sent];
    },
    clear() {
      sent.length = 0;
      idsByKey.clear();
    },
    async send(message) {
      if (options.outboxFile === undefined && process.env.NODE_ENV === "production") {
        // In memory, production mail would vanish without a trace.
        console.error("mailing: fakeMailProvider() refuses to run in production without an outboxFile; configure a real provider");
        return { status: "unavailable" };
      }
      const refusal = options.respond?.(message);
      if (refusal !== undefined) return refusal;

      const knownId = message.idempotencyKey === null ? undefined : idsByKey.get(message.idempotencyKey);
      if (knownId !== undefined) return { status: "sent", id: knownId };

      counter += 1;
      const captured: CapturedMail = { ...message, headers: { ...message.headers }, id: `fake-${String(counter)}-${crypto.randomUUID()}` };
      if (options.outboxFile !== undefined) {
        await appendFile(options.outboxFile, `${JSON.stringify(captured)}\n`, "utf8");
      }
      sent.push(captured);
      if (message.idempotencyKey !== null) idsByKey.set(message.idempotencyKey, captured.id);
      return { status: "sent", id: captured.id };
    },
  };
}
