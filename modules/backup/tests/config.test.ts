import { describe, expect, it } from "vitest";
import { collectSecrets, readReadConfig, readUploadConfig, redactSecrets } from "@softure-ai/backup/offsite";

const RECIPIENT = "age1ql3z7hjy54pw3hyww5ayyfg7zqgvc7w3j2elw8zmrj2kg5sfn9aqmcac8p";

const UPLOAD_ENV = {
  BACKUP_S3_ENDPOINT: "https://abc123.r2.cloudflarestorage.com",
  BACKUP_S3_BUCKET: "acme-backups",
  BACKUP_S3_ACCESS_KEY_ID: "write-id",
  BACKUP_S3_SECRET_ACCESS_KEY: "write-secret",
  BACKUP_AGE_RECIPIENT: RECIPIENT,
};

describe("readUploadConfig", () => {
  it("is not configured when no name is set, empty values included", () => {
    expect(readUploadConfig({}, "acme-app")).toEqual({ status: "not_configured" });
    expect(readUploadConfig({ BACKUP_S3_BUCKET: "", BACKUP_S3_ENDPOINT: "  " }, "acme-app")).toEqual({ status: "not_configured" });
  });

  it("reads a full configuration with the app name as the prefix and region auto", () => {
    const result = readUploadConfig(UPLOAD_ENV, "acme-app");
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.config.recipient).toBe(RECIPIENT);
    expect(result.config.store).toEqual({
      endpoint: new URL("https://abc123.r2.cloudflarestorage.com"),
      region: "auto",
      bucket: "acme-backups",
      prefix: "acme-app",
      accessKeyId: "write-id",
      secretAccessKey: "write-secret",
    });
  });

  it("takes BACKUP_S3_PREFIX and BACKUP_S3_REGION over the defaults", () => {
    const result = readUploadConfig({ ...UPLOAD_ENV, BACKUP_S3_PREFIX: "prod/acme", BACKUP_S3_REGION: "eu-central" }, "acme-app");
    expect(result.status === "ok" && [result.config.store.prefix, result.config.store.region]).toEqual(["prod/acme", "eu-central"]);
  });

  it("names every missing or wrong setting without repeating a value", () => {
    const result = readUploadConfig(
      { BACKUP_S3_BUCKET: "Bad_Bucket", BACKUP_S3_ENDPOINT: "ftp://store", BACKUP_AGE_RECIPIENT: "AGE-SECRET-KEY-1ABC", BACKUP_S3_SECRET_ACCESS_KEY: "s3cr3t" },
      "acme-app",
    );
    expect(result.status).toBe("invalid");
    if (result.status !== "invalid") return;
    expect(result.problems).toEqual([
      "BACKUP_S3_ENDPOINT must start with https:// (or http:// for a local MinIO)",
      "BACKUP_S3_BUCKET is not an S3 bucket name",
      "BACKUP_S3_ACCESS_KEY_ID is not set",
      "BACKUP_AGE_RECIPIENT is not an age public key (age1…)",
    ]);
    expect(result.problems.join(" ")).not.toContain("s3cr3t");
    expect(result.problems.join(" ")).not.toContain("AGE-SECRET-KEY");
  });

  it("refuses an endpoint with credentials or a query, and a prefix that could climb out", () => {
    const withUser = readUploadConfig({ ...UPLOAD_ENV, BACKUP_S3_ENDPOINT: "https://user:pw@store.example" }, "acme-app");
    expect(withUser.status === "invalid" && withUser.problems).toEqual(["BACKUP_S3_ENDPOINT must not carry a user or password"]);
    const climbing = readUploadConfig({ ...UPLOAD_ENV, BACKUP_S3_PREFIX: "../other-app" }, "acme-app");
    expect(climbing.status === "invalid" && climbing.problems).toEqual(["BACKUP_S3_PREFIX is not a key prefix (lower-case path segments)"]);
    const appName = readUploadConfig(UPLOAD_ENV, "Acme App");
    expect(appName.status === "invalid" && appName.problems).toEqual(['the app name "Acme App" is not a key prefix; set BACKUP_S3_PREFIX']);
  });
});

describe("readReadConfig", () => {
  it("uses the read token, never the write one", () => {
    const result = readReadConfig(
      { ...UPLOAD_ENV, BACKUP_S3_READ_ACCESS_KEY_ID: "read-id", BACKUP_S3_READ_SECRET_ACCESS_KEY: "read-secret" },
      "acme-app",
    );
    expect(result.status === "ok" && [result.config.accessKeyId, result.config.secretAccessKey]).toEqual(["read-id", "read-secret"]);
    const writeOnly = readReadConfig(UPLOAD_ENV, "acme-app");
    expect(writeOnly.status === "invalid" && writeOnly.problems).toEqual([
      "BACKUP_S3_READ_ACCESS_KEY_ID is not set",
      "BACKUP_S3_READ_SECRET_ACCESS_KEY is not set",
    ]);
  });
});

describe("redactSecrets", () => {
  it("replaces every secret value of the environment, and ignores values too short to be one", () => {
    const secrets = collectSecrets({ ...UPLOAD_ENV, BACKUP_S3_READ_SECRET_ACCESS_KEY: "abc" });
    expect(secrets).toEqual(["write-id", "write-secret"]);
    expect(redactSecrets("denied for write-id with write-secret, write-secret", secrets)).toBe("denied for *** with ***, ***");
  });
});
