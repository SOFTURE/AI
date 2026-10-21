// Key rotation (`reencryptConnections` and `softure-connections rotate-keys`), and the `key` command.
import { CONNECTIONS_USAGE, EXIT_FAILED, EXIT_OK, EXIT_USAGE, runConnectionsCli } from "@softure-ai/connections/cli";
import { getAccessToken, getCredential, readKeyring, reencryptConnections, saveCredential, startAuthorization } from "@softure-ai/connections/server";
import { createTestKeyring } from "@softure-ai/connections/testing";
import type { CommandDatabase } from "@softure-ai/db";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { connectFake } from "./connect.js";
import { ADMIN, createTestConnections, listRows, type TestConnections } from "./support.js";

describe("key rotation", () => {
  let test: TestConnections;
  let rotated: TestConnections["ctx"];

  beforeEach(async () => {
    test = await createTestConnections({ keys: ["k1"] });
    await connectFake(test);
    await saveCredential(test.ctx, { provider: "raindrop", credential: { kind: "api_key", apiKey: "rd" }, actorId: ADMIN });
    await startAuthorization(test.ctx, { provider: "fake", actorId: ADMIN });
    rotated = { ...test.ctx, env: { ...test.ctx.env, ...createTestKeyring(["k2", "k1"]) } };
  });
  afterEach(async () => {
    await test.database.close();
  });

  it("counts in a dry run and writes nothing", async () => {
    expect(await reencryptConnections(rotated, { dryRun: true })).toEqual({
      ok: true,
      value: { currentKeyId: "k2", connections: 2, pendingAuthorizations: 1, unreadable: [] },
    });
    expect(await listRows(test.database)).toEqual(["fake/default connected oauth k1", "raindrop/default connected api_key k1"]);
  });

  it("re-seals every connection under the new key, after which the old key can go", async () => {
    expect((await reencryptConnections(rotated, { dryRun: false })).ok).toBe(true);
    expect(await listRows(test.database)).toEqual(["fake/default connected oauth k2", "raindrop/default connected api_key k2"]);
    const onlyNew = { ...test.ctx, env: { ...test.ctx.env, ...createTestKeyring(["k2"]) } };
    expect((await getAccessToken(onlyNew, { provider: "fake" })).ok).toBe(true);
    expect(await getCredential(onlyNew, { provider: "raindrop" })).toEqual({ ok: true, value: { kind: "api_key", apiKey: "rd" } });
    expect(await reencryptConnections(onlyNew, { dryRun: false })).toEqual({ ok: true, value: { currentKeyId: "k2", connections: 0, pendingAuthorizations: 0, unreadable: [] } });
  });

  it("reports connections whose key is gone and leaves them", async () => {
    const lost = { ...test.ctx, env: { ...test.ctx.env, ...createTestKeyring(["k3"]) } };
    const result = await reencryptConnections(lost, { dryRun: false });
    expect(result.ok && result.value.unreadable).toEqual([
      { provider: "fake", accountId: "default", error: "connections.key_unknown" },
      { provider: "raindrop", accountId: "default", error: "connections.key_unknown" },
    ]);
    expect(await reencryptConnections({ ...test.ctx, env: {} }, { dryRun: true })).toEqual({ ok: false, error: "connections.key_missing" });
  });

  describe("softure-connections", () => {
    let closed: number;

    async function run(argv: string[], env = rotated.env) {
      closed = 0;
      const lines: string[] = [];
      const errors: string[] = [];
      const openDatabase = (): Promise<CommandDatabase> =>
        Promise.resolve({
          handle: { kind: "pglite", db: test.database.db, client: test.database.client, close: () => Promise.resolve() },
          close: () => Promise.resolve(void (closed += 1)),
        });
      const code = await runConnectionsCli({
        config: test.config,
        argv,
        output: { log: (line) => lines.push(line), error: (line) => errors.push(line) },
        clock: test.clock,
        ...(env === undefined ? {} : { env }),
        openDatabase,
      });
      return { code, lines, errors };
    }

    it("rotate-keys counts by default and re-seals with --commit, closing its database", async () => {
      expect(await run(["rotate-keys"])).toEqual({
        code: EXIT_OK,
        lines: ['softure-connections rotate-keys: would re-seal 2 connections under key "k2" and would drop 1 pending authorizations (dry run; add --commit)'],
        errors: [],
      });
      expect(closed).toBe(1);
      expect(await run(["rotate-keys", "--commit"])).toEqual({
        code: EXIT_OK,
        lines: ['softure-connections rotate-keys: re-sealed 2 connections under key "k2" and dropped 1 pending authorizations'],
        errors: [],
      });
      expect(await listRows(test.database)).toEqual(["fake/default connected oauth k2", "raindrop/default connected api_key k2"]);
    });

    it("rotate-keys fails on unreadable connections, a missing keyring and stray arguments", async () => {
      const lost = await run(["rotate-keys"], { ...createTestKeyring(["k3"]) });
      expect(lost.code).toBe(EXIT_FAILED);
      expect(lost.errors).toEqual([
        "softure-connections rotate-keys: fake/default cannot be opened (connections.key_unknown); connect it again",
        "softure-connections rotate-keys: raindrop/default cannot be opened (connections.key_unknown); connect it again",
      ]);
      expect(await run(["rotate-keys"], {})).toMatchObject({ code: EXIT_FAILED, errors: ["softure-connections rotate-keys: SOFTURE_CONNECTIONS_KEYS is not set"] });
      expect(await run(["rotate-keys", "--force"])).toMatchObject({ code: EXIT_USAGE, errors: ['softure-connections rotate-keys: unexpected argument "--force"'] });
    });

    it("key prints a keyring entry the module reads, and only that", async () => {
      const printed = await run(["key", "2026q4"]);
      expect(printed.code).toBe(EXIT_OK);
      expect(printed.lines).toHaveLength(1);
      expect(printed.lines[0]).toMatch(/^2026q4:[A-Za-z0-9_-]{43}$/);
      expect(readKeyring({ SOFTURE_CONNECTIONS_KEYS: printed.lines[0] }).ok).toBe(true);
      expect(await run(["key", "bad:id"])).toMatchObject({ code: EXIT_USAGE });
    });

    it("prints its usage for help and refuses unknown commands", async () => {
      expect(await run(["--help"])).toEqual({ code: EXIT_OK, lines: [CONNECTIONS_USAGE], errors: [] });
      expect(await run(["prune"])).toEqual({ code: EXIT_USAGE, lines: [], errors: ['softure-connections: unknown command "prune"', CONNECTIONS_USAGE] });
    });
  });
});
