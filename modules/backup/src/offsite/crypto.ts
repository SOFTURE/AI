// age encryption with the pure-JS implementation by the age author (interoperable with the `age` command): the
// server holds only the public key (`age1…`); the private key (`AGE-SECRET-KEY-1…`) is read at run time from a file
// or stdin, never from an argument.
import { createReadStream, createWriteStream } from "node:fs";
import { Readable, Writable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { Decrypter, Encrypter } from "age-encryption";

const IDENTITY_PATTERN = /^AGE-SECRET-KEY-(PQ-)?1[0-9A-Z]+$/;

/** Encrypts the file at `source` to `recipient` into `target`. */
export async function encryptFile(source: string, target: string, recipient: string): Promise<void> {
  const encrypter = new Encrypter();
  encrypter.addRecipient(recipient);
  const input = Readable.toWeb(createReadStream(source)) as ReadableStream<Uint8Array>;
  const encrypted = await encrypter.encrypt(input);
  await pipeline(Readable.fromWeb(encrypted as import("node:stream/web").ReadableStream<Uint8Array>), createWriteStream(target, { mode: 0o600 }));
}

/** A stream of the plaintext of an age `stream`, decrypted with `identities`. */
export async function decryptStream(stream: ReadableStream<Uint8Array>, identities: readonly string[]): Promise<ReadableStream<Uint8Array>> {
  const decrypter = new Decrypter();
  for (const identity of identities) decrypter.addIdentity(identity);
  return decrypter.decrypt(stream);
}

/** Writes a web stream to a file, owner read and write only. */
export async function writeStreamToFile(stream: ReadableStream<Uint8Array>, path: string): Promise<void> {
  await pipeline(Readable.fromWeb(stream as import("node:stream/web").ReadableStream<Uint8Array>), createWriteStream(path, { mode: 0o600 }));
}

/** Pipes a web stream into a Node writable (a child's stdin). */
export async function pipeStreamTo(stream: ReadableStream<Uint8Array>, target: Writable): Promise<void> {
  await pipeline(Readable.fromWeb(stream as import("node:stream/web").ReadableStream<Uint8Array>), target);
}

export type IdentitiesResult = { ok: true; identities: string[] } | { ok: false; problem: string };

/**
 * The identities of an age key file's text (the `age-keygen` output: comment lines and one or more keys). The
 * problem never repeats the text.
 */
export function parseIdentities(text: string): IdentitiesResult {
  const identities = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("#"));
  if (identities.length === 0) return { ok: false, problem: "the identity holds no AGE-SECRET-KEY-1… line" };
  if (!identities.every((line) => IDENTITY_PATTERN.test(line))) {
    return { ok: false, problem: "the identity has a line that is not an age secret key (AGE-SECRET-KEY-1…)" };
  }
  return { ok: true, identities };
}
