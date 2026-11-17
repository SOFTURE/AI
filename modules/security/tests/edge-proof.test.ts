// edgeProofIp: the inner resolver is trusted only on a request that carries the edge's secret, so a container that
// reaches the app around its router cannot choose its own rate-limit key.
import { cloudflareIp, EDGE_PROOF_HEADER, edgeProofIp, type ClientIpResolver } from "@softure-ai/security";
import { describe, expect, it, vi } from "vitest";

const SECRET = "0123456789abcdef0123456789abcdef";

function request(entries: Record<string, string>): Headers {
  return new Headers(entries);
}

describe("edgeProofIp", () => {
  it("resolves the inner resolver's address when the proof header carries the secret", () => {
    const resolve = edgeProofIp({ resolver: cloudflareIp(), secret: SECRET });

    expect(resolve(request({ [EDGE_PROOF_HEADER]: SECRET, "cf-connecting-ip": "203.0.113.7" }))).toBe("203.0.113.7");
  });

  it("resolves nothing when the proof header is missing, so a forged CF-Connecting-IP is not trusted", () => {
    const resolve = edgeProofIp({ resolver: cloudflareIp(), secret: SECRET });

    expect(resolve(request({ "cf-connecting-ip": "203.0.113.7" }))).toBeNull();
  });

  it.each([
    ["a wrong value", "fedcba9876543210fedcba9876543210"],
    ["the secret with a suffix", `${SECRET}x`],
    ["a prefix of the secret", SECRET.slice(0, 20)],
    ["an empty value", ""],
    ["the secret twice (a repeated header)", `${SECRET}, ${SECRET}`],
  ])("resolves nothing for %s", (_label, proof) => {
    const resolve = edgeProofIp({ resolver: cloudflareIp(), secret: SECRET });

    expect(resolve(request({ [EDGE_PROOF_HEADER]: proof, "cf-connecting-ip": "203.0.113.7" }))).toBeNull();
  });

  it("does not run the inner resolver on an unproven request", () => {
    const inner = vi.fn<ClientIpResolver>(() => "203.0.113.7");
    const resolve = edgeProofIp({ resolver: inner, secret: SECRET });

    resolve(request({}));

    expect(inner).not.toHaveBeenCalled();
  });

  it("reads a custom header name, case-insensitively", () => {
    const resolve = edgeProofIp({ resolver: cloudflareIp(), secret: SECRET, header: "X-Acme-Edge-Proof" });

    expect(resolve(request({ "x-acme-edge-proof": SECRET, "cf-connecting-ip": "203.0.113.7" }))).toBe("203.0.113.7");
    expect(resolve(request({ [EDGE_PROOF_HEADER]: SECRET, "cf-connecting-ip": "203.0.113.7" }))).toBeNull();
  });

  it("returns the inner resolver unchanged when no secret is configured", () => {
    const inner = cloudflareIp();

    expect(edgeProofIp({ resolver: inner, secret: undefined })).toBe(inner);
  });

  it.each([
    ["an empty secret", { secret: "" }, "edgeProofIp: the secret must be at least 16 characters long, got 0"],
    ["a short secret", { secret: "short" }, "edgeProofIp: the secret must be at least 16 characters long, got 5"],
    ["an empty header name", { secret: SECRET, header: " " }, "edgeProofIp: the header name must not be empty"],
    ["an invalid header name", { secret: SECRET, header: "x proof" }, 'edgeProofIp: "x proof" is not a valid header name'],
  ])("throws for %s", (_label, options, message) => {
    expect(() => edgeProofIp({ resolver: cloudflareIp(), ...options })).toThrow(new TypeError(message));
  });

  it("throws when the resolver is not a function", () => {
    expect(() => edgeProofIp({ resolver: "cf-connecting-ip" as unknown as ClientIpResolver, secret: SECRET })).toThrow(
      "edgeProofIp: resolver must be a client-IP resolver, e.g. cloudflareIp()",
    );
  });
});
