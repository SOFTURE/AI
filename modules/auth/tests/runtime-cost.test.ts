import { SCRYPT_DEFAULTS, users } from "@softure-ai/auth";
import { getAuthOptions, hashPassword, loginUser, registerUser } from "@softure-ai/auth/server";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { CLIENT, createConfig, createTestAuth, FAST_SCRYPT, PASSWORD, type TestAuth } from "./support.js";

const EMAIL = "ada@example.com";
const WORKERS = { host: "cloudflare" } as const;
/** No `password.scrypt` fields: the runtime's defaults apply. */
const RUNTIME_DEFAULT = { password: { scrypt: {} } } as const;

describe("the scrypt cost of each runtime", () => {
  it("is OWASP's 128 MiB profile on Node when the app sets none", () => {
    const config = createConfig({ auth: RUNTIME_DEFAULT });
    expect(getAuthOptions(config).password.scrypt).toEqual({ cost: 2 ** 17, blockSize: 8, parallelization: 1 });
  });

  it("is OWASP's 16 MiB profile on Workers when the app sets none", () => {
    const config = createConfig({ auth: RUNTIME_DEFAULT, platform: WORKERS });
    expect(getAuthOptions(config).password.scrypt).toEqual({ cost: 2 ** 14, blockSize: 8, parallelization: 5 });
  });

  it("takes each field the app sets and the runtime's default for the rest", () => {
    const config = createConfig({ auth: { password: { scrypt: { cost: 2 ** 15 } } }, platform: WORKERS });
    expect(getAuthOptions(config).password.scrypt).toEqual({ cost: 2 ** 15, blockSize: 8, parallelization: 5 });
  });

  it("returns the same options object on every call", () => {
    const config = createConfig({ auth: RUNTIME_DEFAULT, platform: WORKERS });
    expect(getAuthOptions(config)).toBe(getAuthOptions(config));
    expect(getAuthOptions(config).cookie).toEqual(getAuthOptions(createConfig()).cookie);
  });
});

describe("a login after the app moved hosts", () => {
  let test: TestAuth;

  afterEach(async () => {
    await test.database.close();
  });

  /** An account whose stored hash is `hash`, as if it was written on the other host. */
  async function storeHash(hash: string): Promise<void> {
    const registered = await registerUser(test.ctx, { email: EMAIL, password: PASSWORD, hasConsented: true, clientKey: "ip:198.51.100.1" });
    if (!registered.ok) throw new Error(`setup: registration failed with ${registered.error}`);
    await test.database.db.update(users).set({ passwordHash: hash }).where(eq(users.email, EMAIL));
  }

  async function readHash(): Promise<string | undefined> {
    const [row] = await test.database.db.select().from(users).where(eq(users.email, EMAIL));
    return row?.passwordHash;
  }

  it("on Workers accepts a hash made on Node and rehashes it into the Workers cost", async () => {
    test = await createTestAuth({ auth: RUNTIME_DEFAULT, platform: WORKERS });
    await storeHash(await hashPassword(PASSWORD, FAST_SCRYPT));
    expect((await loginUser(test.ctx, { email: EMAIL, password: PASSWORD, clientKey: CLIENT })).ok).toBe(true);
    expect((await readHash())?.startsWith("scrypt$16384$8$5$")).toBe(true);
    expect((await loginUser(test.ctx, { email: EMAIL, password: PASSWORD, clientKey: CLIENT })).ok).toBe(true);
  });

  it("on Node accepts a hash made on Workers and rehashes it into the Node cost", async () => {
    test = await createTestAuth({ auth: { password: { scrypt: { cost: 2 ** 11 } } } });
    await storeHash(await hashPassword(PASSWORD, SCRYPT_DEFAULTS.workers));
    expect((await loginUser(test.ctx, { email: EMAIL, password: PASSWORD, clientKey: CLIENT })).ok).toBe(true);
    expect((await readHash())?.startsWith("scrypt$2048$8$1$")).toBe(true);
  });

  it("on Workers refuses a wrong password against a hash made on Node and keeps the hash", async () => {
    test = await createTestAuth({ auth: RUNTIME_DEFAULT, platform: WORKERS });
    const stored = await hashPassword(PASSWORD, FAST_SCRYPT);
    await storeHash(stored);
    expect((await loginUser(test.ctx, { email: EMAIL, password: "wrong horse battery", clientKey: CLIENT })).ok).toBe(false);
    expect(await readHash()).toBe(stored);
  });
});
