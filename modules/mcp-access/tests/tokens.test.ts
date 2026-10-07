// Issuing, listing, revoking and verifying tokens: only the hash is stored, the limit counts
// unexpired tokens per account, expiry and revocation take effect at once, and write access needs
// both the token and the app's allowWrites.
import { hashAccessToken, issueAccessToken, listAccessTokens, pruneAccessTokens, revokeAccessToken, verifyAccessToken } from "@softure-ai/mcp-access/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createConfig, createTestMcp, failOn, createUser, NOW, OPTIONS, type TestMcp } from "./support.js";

const DAY_MS = 24 * 60 * 60 * 1000;

describe("access tokens", () => {
  let test: TestMcp;
  let alice: string;
  let bob: string;

  beforeEach(async () => {
    test = await createTestMcp();
    alice = await createUser(test.database, "alice@example.com");
    bob = await createUser(test.database, "bob@example.com");
  });
  afterEach(async () => {
    await test.database.close();
    vi.restoreAllMocks();
  });

  async function issue(userId: string, name = "Laptop", canWrite = false) {
    const result = await issueAccessToken(test.ctx, { userId, name, canWrite });
    if (!result.ok) throw new Error(`issue failed: ${result.error}`);
    return result.value;
  }

  async function storedRows() {
    const result = await test.database.client.query<{ name: string; token_hash: string; can_write: boolean; last_used_at: Date | null }>(
      "SELECT name, token_hash, can_write, last_used_at FROM mcp.access_tokens ORDER BY created_at, name",
    );
    return result.rows;
  }

  describe("issueAccessToken", () => {
    it("returns the plaintext once and stores only its sha256, with the name, scope and a 90-day expiry", async () => {
      const issued = await issue(alice, "  Laptop  ", true);
      expect(issued.token).toMatch(/^sftmcp_[A-Za-z0-9_-]{43}$/);
      expect([issued.name, issued.canWrite, issued.expiresAt]).toEqual(["Laptop", true, new Date(NOW.getTime() + 90 * DAY_MS)]);
      const rows = await storedRows();
      expect(rows.map((row) => [row.name, row.token_hash, row.can_write])).toEqual([["Laptop", hashAccessToken(issued.token), true]]);
      expect(JSON.stringify(rows)).not.toContain(issued.token);
    });

    it("issues a different token every time", async () => {
      expect((await issue(alice)).token).not.toBe((await issue(alice)).token);
    });

    it("stores a read-only token when the app does not allow writes, whatever was asked", async () => {
      const readOnly = await createTestMcp(createConfig({ ...OPTIONS, allowWrites: false, tools: [] }));
      try {
        const owner = await createUser(readOnly.database, "carol@example.com");
        const result = await issueAccessToken(readOnly.ctx, { userId: owner, name: "Laptop", canWrite: true });
        expect(result.ok && result.value.canWrite).toBe(false);
      } finally {
        await readOnly.database.close();
      }
    });

    it("uses the configured lifetime", async () => {
      const short = await createTestMcp(createConfig({ ...OPTIONS, tokenLifetimeDays: 7 }));
      try {
        const owner = await createUser(short.database, "carol@example.com");
        const result = await issueAccessToken(short.ctx, { userId: owner, name: "Laptop", canWrite: false });
        expect(result.ok && result.value.expiresAt).toEqual(new Date(NOW.getTime() + 7 * DAY_MS));
      } finally {
        await short.database.close();
      }
    });

    it.each([
      ["an empty name", "", "mcp-access.name_required"],
      ["a blank name", "   ", "mcp-access.name_required"],
      ["a name over 60 characters", "x".repeat(61), "mcp-access.name_too_long"],
    ])("refuses %s and stores nothing", async (_case, name, error) => {
      expect(await issueAccessToken(test.ctx, { userId: alice, name, canWrite: false })).toEqual({ ok: false, error });
      expect(await storedRows()).toEqual([]);
    });

    it("accepts a name of exactly 60 characters", async () => {
      expect((await issue(alice, "x".repeat(60))).name).toHaveLength(60);
    });
  });

  describe("the per-account limit", () => {
    const limited = () => createTestMcp(createConfig({ ...OPTIONS, maxTokensPerUser: 2 }));

    it("refuses a token over the limit, counting only the account's own tokens", async () => {
      const small = await limited();
      try {
        const owner = await createUser(small.database, "carol@example.com");
        const other = await createUser(small.database, "dave@example.com");
        const issueFor = (userId: string) => issueAccessToken(small.ctx, { userId, name: "Laptop", canWrite: false });
        expect((await issueFor(owner)).ok).toBe(true);
        expect((await issueFor(owner)).ok).toBe(true);
        expect(await issueFor(owner)).toEqual({ ok: false, error: "mcp-access.token_limit_reached" });
        expect((await issueFor(other)).ok).toBe(true);
      } finally {
        await small.database.close();
      }
    });

    it("does not count expired tokens, and deletes the owner's expired ones when issuing", async () => {
      const small = await limited();
      try {
        const owner = await createUser(small.database, "carol@example.com");
        const other = await createUser(small.database, "dave@example.com");
        const issueFor = (userId: string, name: string) => issueAccessToken(small.ctx, { userId, name, canWrite: false });
        await issueFor(owner, "Old 1");
        await issueFor(owner, "Old 2");
        await issueFor(other, "Other old");
        small.clock.advance(90 * DAY_MS);
        expect((await issueFor(owner, "New")).ok).toBe(true);
        const names = await small.database.client.query<{ name: string }>("SELECT name FROM mcp.access_tokens ORDER BY name");
        expect(names.rows.map((row) => row.name)).toEqual(["New", "Other old"]);
      } finally {
        await small.database.close();
      }
    });

    it("holds under parallel requests: never more tokens than the limit", async () => {
      const small = await limited();
      try {
        const owner = await createUser(small.database, "carol@example.com");
        const results = await Promise.all(
          Array.from({ length: 5 }, (_, index) => issueAccessToken(small.ctx, { userId: owner, name: `Laptop ${String(index)}`, canWrite: false })),
        );
        expect(results.filter((result) => result.ok)).toHaveLength(2);
        expect(results.filter((result) => !result.ok).map((result) => !result.ok && result.error)).toEqual([
          "mcp-access.token_limit_reached",
          "mcp-access.token_limit_reached",
          "mcp-access.token_limit_reached",
        ]);
      } finally {
        await small.database.close();
      }
    });
  });

  describe("listAccessTokens", () => {
    it("lists the account's own tokens, newest first, without any hash", async () => {
      const first = await issue(alice, "First", true);
      test.clock.advance(60_000);
      const second = await issue(alice, "Second");
      await issue(bob, "Bob's");
      expect(await listAccessTokens(test.ctx, alice)).toEqual([
        { id: second.id, name: "Second", canWrite: false, createdAt: new Date(NOW.getTime() + 60_000), expiresAt: second.expiresAt, lastUsedAt: null },
        { id: first.id, name: "First", canWrite: true, createdAt: NOW, expiresAt: first.expiresAt, lastUsedAt: null },
      ]);
    });

    it("keeps an expired token on the list until it is pruned", async () => {
      await issue(alice);
      test.clock.advance(91 * DAY_MS);
      expect(await listAccessTokens(test.ctx, alice)).toHaveLength(1);
      expect(await pruneAccessTokens(test.ctx)).toBe(1);
      expect(await listAccessTokens(test.ctx, alice)).toEqual([]);
    });

    it("is empty for an account without tokens", async () => {
      expect(await listAccessTokens(test.ctx, bob)).toEqual([]);
    });
  });

  describe("revokeAccessToken", () => {
    it("deletes the owner's token, after which it no longer verifies", async () => {
      const issued = await issue(alice);
      expect(await revokeAccessToken(test.ctx, { userId: alice, tokenId: issued.id })).toEqual({ ok: true, value: undefined });
      expect(await verifyAccessToken(test.ctx, issued.token)).toBeNull();
      expect(await storedRows()).toEqual([]);
    });

    it("cannot revoke another account's token", async () => {
      const issued = await issue(alice);
      expect(await revokeAccessToken(test.ctx, { userId: bob, tokenId: issued.id })).toEqual({ ok: false, error: "mcp-access.token_not_found" });
      expect(await verifyAccessToken(test.ctx, issued.token)).not.toBeNull();
    });

    it.each([
      ["an id revoked already", null],
      ["an id that is not a uuid", "1 OR 1=1"],
      ["an empty id", ""],
    ])("answers not found for %s", async (_case, tokenId) => {
      const issued = await issue(alice);
      await revokeAccessToken(test.ctx, { userId: alice, tokenId: issued.id });
      expect(await revokeAccessToken(test.ctx, { userId: alice, tokenId: tokenId ?? issued.id })).toEqual({
        ok: false,
        error: "mcp-access.token_not_found",
      });
    });
  });

  describe("verifyAccessToken", () => {
    it("returns the owner, the effective write access and the expiry", async () => {
      const issued = await issue(alice, "Laptop", true);
      expect(await verifyAccessToken(test.ctx, issued.token)).toEqual({
        tokenId: issued.id,
        userId: alice,
        canWrite: true,
        expiresAt: issued.expiresAt,
        grantId: null,
      });
    });

    it("turns a write token into a read-only one once the app stops allowing writes", async () => {
      const issued = await issue(alice, "Laptop", true);
      const readOnlyCtx = { ...test.ctx, config: createConfig({ ...OPTIONS, allowWrites: false, tools: [] }) };
      expect((await verifyAccessToken(readOnlyCtx, issued.token))?.canWrite).toBe(false);
    });

    it.each([
      ["an unknown token", "sftmcp_" + "A".repeat(43)],
      ["a token without the prefix", "A".repeat(50)],
      ["a token of the wrong length", "sftmcp_short"],
      ["an empty string", ""],
    ])("returns null for %s", async (_case, token) => {
      await issue(alice);
      expect(await verifyAccessToken(test.ctx, token)).toBeNull();
    });

    it("works until the last millisecond before the expiry and not at it", async () => {
      const issued = await issue(alice);
      test.clock.advance(90 * DAY_MS - 1);
      expect(await verifyAccessToken(test.ctx, issued.token)).not.toBeNull();
      test.clock.advance(1);
      expect(await verifyAccessToken(test.ctx, issued.token)).toBeNull();
    });

    it("records the last use, at most once a minute", async () => {
      const issued = await issue(alice);
      await verifyAccessToken(test.ctx, issued.token);
      expect((await storedRows())[0]?.last_used_at).toEqual(NOW);
      test.clock.advance(30_000);
      await verifyAccessToken(test.ctx, issued.token);
      expect((await storedRows())[0]?.last_used_at).toEqual(NOW);
      test.clock.advance(31_000);
      await verifyAccessToken(test.ctx, issued.token);
      expect((await storedRows())[0]?.last_used_at).toEqual(new Date(NOW.getTime() + 61_000));
    });

    it("still verifies when recording the use fails, and logs the token id but never the token", async () => {
      const issued = await issue(alice);
      const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
      const db = failOn(test.ctx.db, "update", "connect ECONNREFUSED");
      expect((await verifyAccessToken({ ...test.ctx, db }, issued.token))?.userId).toBe(alice);
      const logged = log.mock.calls.map((call) => String(call[0])).join("\n");
      expect(logged).toBe(`@softure-ai/mcp-access: recording the use of token ${issued.id} failed: Error`);
    });
  });

  describe("tokens an app issued before adopting the module", () => {
    const LEGACY = "0123456789abcdef".repeat(4);
    const legacyCtx = () => ({ ...test.ctx, config: createConfig({ ...OPTIONS, legacyTokenPattern: /^[0-9a-f]{64}$/ }) });

    beforeEach(async () => {
      await test.database.client.query(
        "INSERT INTO mcp.access_tokens (user_id, name, token_hash, can_write, created_at, expires_at) VALUES ($1, 'Old laptop', $2, true, $3, $4)",
        [alice, hashAccessToken(LEGACY), NOW, new Date(NOW.getTime() + DAY_MS)],
      );
    });

    it("verify with legacyTokenPattern, by the same sha256", async () => {
      expect(await verifyAccessToken(legacyCtx(), LEGACY)).toMatchObject({ userId: alice, canWrite: true, grantId: null });
    });

    it("do not verify without the pattern", async () => {
      expect(await verifyAccessToken(test.ctx, LEGACY)).toBeNull();
    });

    it("still need an unexpired row: the pattern only lets the value be looked up", async () => {
      expect(await verifyAccessToken(legacyCtx(), "f".repeat(64))).toBeNull();
      test.clock.set(new Date(NOW.getTime() + DAY_MS));
      expect(await verifyAccessToken(legacyCtx(), LEGACY)).toBeNull();
    });

    it("refuse a value over 512 characters before the pattern or a query runs", async () => {
      const pattern = /^[0-9a-f]+$/;
      const test_ = vi.spyOn(pattern, "test");
      const ctx = { ...test.ctx, config: createConfig({ ...OPTIONS, legacyTokenPattern: pattern }), db: failOn(test.ctx.db, "select", "must not query") };
      expect(await verifyAccessToken(ctx, "a".repeat(513))).toBeNull();
      expect(test_).not.toHaveBeenCalled();
    });

    it("leave new tokens with the module's prefix", async () => {
      const issued = await issueAccessToken(legacyCtx(), { userId: alice, name: "Laptop", canWrite: false });
      expect(issued.ok && issued.value.token).toMatch(/^sftmcp_[A-Za-z0-9_-]{43}$/);
    });
  });

  it("goes with its account: deleting the user deletes the tokens", async () => {
    await issue(alice);
    await test.database.client.query("DELETE FROM auth.users WHERE id = $1", [alice]);
    expect(await storedRows()).toEqual([]);
  });
});
