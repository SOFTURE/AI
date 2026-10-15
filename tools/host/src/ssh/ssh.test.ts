import { createPrivateKey, createPublicKey, sign, verify } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createFakeRunner } from "../testing/fake-runner.js";
import { parseInventory } from "../inventory/index.js";
import { formatKnownHosts, generateDeployKey, getFingerprint, parseHostKeys, readHostKeys } from "./index.js";

/** Reads the SSH wire strings of a buffer in order. */
function readStrings(bytes: Buffer, count: number, start = 0): { values: Buffer[]; end: number } {
  const values: Buffer[] = [];
  let offset = start;
  for (let index = 0; index < count; index += 1) {
    const length = bytes.readUInt32BE(offset);
    values.push(bytes.subarray(offset + 4, offset + 4 + length));
    offset += 4 + length;
  }
  return { values, end: offset };
}

describe("generateDeployKey", () => {
  const key = generateDeployKey("notes-release");

  it("writes a public line with the comment", () => {
    expect(key.publicKey).toMatch(/^ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI[A-Za-z0-9+/]{43} notes-release$/);
  });

  it("writes an unencrypted openssh-key-v1 container whose secret signs for the public key", () => {
    const lines = key.privateKey.trim().split("\n");
    expect(lines[0]).toBe("-----BEGIN OPENSSH PRIVATE KEY-----");
    expect(lines.at(-1)).toBe("-----END OPENSSH PRIVATE KEY-----");
    expect(lines.slice(1, -1).every((line) => line.length <= 70)).toBe(true);
    const container = Buffer.from(lines.slice(1, -1).join(""), "base64");
    const magic = "openssh-key-v1\0";
    expect(container.subarray(0, magic.length).toString("latin1")).toBe(magic);
    const header = readStrings(container, 3, magic.length);
    expect(header.values.map((value) => value.toString())).toEqual(["none", "none", ""]);
    expect(container.readUInt32BE(header.end)).toBe(1);
    const sections = readStrings(container, 2, header.end + 4);
    const [publicBlob, privateSection] = sections.values as [Buffer, Buffer];
    expect(publicBlob.toString("base64")).toBe(key.publicKey.split(" ")[1]);
    expect(privateSection.length % 8).toBe(0);
    expect(privateSection.readUInt32BE(0)).toBe(privateSection.readUInt32BE(4));
    const fields = readStrings(privateSection, 4, 8);
    const [type, publicPoint, secret, comment] = fields.values as [Buffer, Buffer, Buffer, Buffer];
    expect(type.toString()).toBe("ssh-ed25519");
    expect(comment.toString()).toBe("notes-release");
    expect(secret.subarray(32).equals(publicPoint)).toBe(true);
    const padding = [...privateSection.subarray(fields.end)];
    expect(padding).toEqual(padding.map((_, index) => index + 1));

    const privateKey = createPrivateKey({
      key: { kty: "OKP", crv: "Ed25519", d: secret.subarray(0, 32).toString("base64url"), x: publicPoint.toString("base64url") },
      format: "jwk",
    });
    const publicKey = createPublicKey({ key: { kty: "OKP", crv: "Ed25519", x: publicPoint.toString("base64url") }, format: "jwk" });
    expect(verify(null, Buffer.from("release"), publicKey, sign(null, Buffer.from("release"), privateKey))).toBe(true);
  });

  it("issues a different key every time", () => {
    expect(generateDeployKey("x").publicKey).not.toBe(generateDeployKey("x").publicKey);
  });
});

describe("getFingerprint", () => {
  it("matches ssh-keygen -l for a known key", () => {
    // The ed25519 key with the secret 00 01 02 … 1f; fingerprint computed independently.
    expect(getFingerprint("ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIAOhB7/zzhC+HXDdGOdLwJln5NYwm6UNXx3chmQSVTG4 any")).toBe(
      "SHA256:lbmsoA0yIEcEiVDRnMWuzm+nV+3ZEEpVIURqFoeSspg",
    );
  });
});

describe("host keys", () => {
  const output = "ssh-ed25519 AAAAED root@srv\necdsa-sha2-nistp256 AAAAEC root@srv\nssh-rsa AAAARSA root@srv\n";

  it("parses the host key files and refuses anything else", () => {
    expect(parseHostKeys(output)).toEqual([
      { type: "ssh-ed25519", key: "AAAAED" },
      { type: "ecdsa-sha2-nistp256", key: "AAAAEC" },
      { type: "ssh-rsa", key: "AAAARSA" },
    ]);
    expect(() => parseHostKeys("")).toThrow("the server returned no host keys");
    expect(() => parseHostKeys("Welcome to the server\n")).toThrow("unexpected line among the server's host keys");
  });

  it("formats known_hosts lines, with brackets on a port other than 22", () => {
    const keys = [{ type: "ssh-ed25519", key: "AAAAED" }];
    expect(formatKnownHosts("srv.example.com", 22, keys)).toBe("srv.example.com ssh-ed25519 AAAAED");
    expect(formatKnownHosts("srv.example.com", 2222, keys)).toBe("[srv.example.com]:2222 ssh-ed25519 AAAAED");
  });

  it("reads them over the admin's own SSH connection in batch mode", async () => {
    const inventory = parseInventory({ server: { host: "srv.example.com", port: 2222, adminUser: "admin" }, edge: { manage: false } }, "t");
    const runner = createFakeRunner(() => ({ stdout: output }));
    await expect(readHostKeys(runner, inventory)).resolves.toHaveLength(3);
    expect(runner.calls[0]?.args).toEqual(["-o", "BatchMode=yes", "-p", "2222", "admin@srv.example.com", "cat /etc/ssh/ssh_host_*_key.pub"]);
    const refused = createFakeRunner(() => ({ status: 255, stderr: "Host key verification failed.\n" }));
    await expect(readHostKeys(refused, inventory)).rejects.toThrow("cannot read the host keys as admin@srv.example.com: Host key verification failed.");
  });
});
