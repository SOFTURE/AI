import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Decrypter, generateIdentity, identityToRecipient } from "age-encryption";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { uploadBackups, type UploadConfig } from "@softure-ai/backup/offsite";
import { BUCKET, REGION, startFakeS3, WRITER, type FakeS3 } from "./support/fake-s3.js";

const NOW = new Date("2026-11-09T03:17:00Z");

let s3: FakeS3;
let dir: string;
let identity: string;
let config: UploadConfig;

beforeEach(async () => {
  s3 = await startFakeS3();
  dir = mkdtempSync(join(tmpdir(), "softure-backup-upload-"));
  identity = await generateIdentity();
  config = {
    recipient: await identityToRecipient(identity),
    store: { endpoint: new URL(s3.endpoint), region: REGION, bucket: BUCKET, prefix: "acme-app", accessKeyId: WRITER.id, secretAccessKey: WRITER.secret },
  };
});

afterEach(async () => {
  await s3.close();
  rmSync(dir, { recursive: true, force: true });
});

function writeBackup(name: string, text: string): string {
  const path = join(dir, name);
  writeFileSync(path, text);
  return path;
}

async function decrypt(data: Buffer): Promise<string> {
  const decrypter = new Decrypter();
  decrypter.addIdentity(identity);
  return decrypter.decrypt(new Uint8Array(data), "text");
}

describe("uploadBackups", () => {
  it("encrypts the dump and the data archive to the recipient and PUTs them with the write token only", async () => {
    const dump = writeBackup("db-20261109T031700Z.dump", "PGDMP the dump");
    const data = writeBackup("data-20261109-031702.tar.gz", "the data archive");
    const record = await uploadBackups({ config, files: [dump, data], now: () => NOW });
    expect(record.result).toBe("ok");
    expect(record.error).toBeNull();
    expect(record.objects.map((object) => [object.kind, object.key])).toEqual([
      ["database", "acme-app/db-20261109T031700Z.dump.age"],
      ["data", "acme-app/data-20261109-031702.tar.gz.age"],
    ]);
    const stored = s3.objects.get("acme-app/db-20261109T031700Z.dump.age");
    expect(stored?.subarray(0, 21).toString()).toBe("age-encryption.org/v1");
    expect(await decrypt(stored ?? Buffer.alloc(0))).toBe("PGDMP the dump");
    expect(record.objects[0]?.bytes).toBe(stored?.length);
    expect(record.sizeBytes).toBe((stored?.length ?? 0) + (s3.objects.get("acme-app/data-20261109-031702.tar.gz.age")?.length ?? 0));
    expect(s3.requests.every((request) => request.startsWith("PUT ") && request.endsWith(WRITER.id))).toBe(true);
    // No plaintext and no temporary file is left behind; the local backups stay as they were.
    expect(readdirSync(dir).sort()).toEqual(["data-20261109-031702.tar.gz", "db-20261109T031700Z.dump"]);
  });

  it("fails as upload_denied when the store refuses the token, with no secret in the message", async () => {
    const dump = writeBackup("db-20261109T031700Z.dump", "PGDMP");
    const wrong = { ...config, store: { ...config.store, secretAccessKey: "not-the-secret" } };
    const record = await uploadBackups({ config: wrong, files: [dump], now: () => NOW });
    expect(record.result).toBe("failed");
    expect(record.error?.code).toBe("upload_denied");
    expect(record.error?.message).toContain("HTTP 403 (SignatureDoesNotMatch");
    expect(record.error?.message).not.toContain("not-the-secret");
    expect(readdirSync(dir)).toEqual(["db-20261109T031700Z.dump"]);
  });

  it("fails as network_error when the store cannot be reached", async () => {
    const dump = writeBackup("db-20261109T031700Z.dump", "PGDMP");
    await s3.close();
    const record = await uploadBackups({ config, files: [dump], now: () => NOW });
    expect(record.error?.code).toBe("network_error");
    expect(record.error?.message).toMatch(/^PUT acme-app\/db-20261109T031700Z\.dump\.age could not reach 127\.0\.0\.1:\d+/);
  });

  it("fails as file_missing for a missing file, another name or no file, before anything is uploaded", async () => {
    const missing = await uploadBackups({ config, files: [join(dir, "db-20261109T031700Z.dump")], now: () => NOW });
    expect(missing.error).toEqual({ code: "file_missing", message: `db-20261109T031700Z.dump is not in ${dir}` });
    const other = await uploadBackups({ config, files: [writeBackup("notes.txt", "x")], now: () => NOW });
    expect(other.error?.code).toBe("file_missing");
    const none = await uploadBackups({ config, files: [], now: () => NOW });
    expect(none.error).toEqual({ code: "file_missing", message: "no backup file was given" });
    expect(s3.requests).toEqual([]);
  });

  it("fails as encrypt_failed for a recipient age cannot use", async () => {
    const dump = writeBackup("db-20261109T031700Z.dump", "PGDMP");
    const record = await uploadBackups({ config: { ...config, recipient: "age1notavalidrecipient00000000000000000000000000" }, files: [dump], now: () => NOW });
    expect(record.error?.code).toBe("encrypt_failed");
    expect(readdirSync(dir)).toEqual(["db-20261109T031700Z.dump"]);
  });
});
