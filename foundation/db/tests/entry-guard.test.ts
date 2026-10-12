// The entry-point guard (issue #404): every entry whose import graph reaches the app's process database must open
// it, or the entry fails only at its first query with "Database is not open".
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { expectEntriesOpenDatabase, findEntriesReachingDatabase } from "@softure-ai/db/testing";

const ENTRIES_DIR = fileURLToPath(new URL("./fixtures/entries/", import.meta.url));
const at = (file: string): string => `${ENTRIES_DIR}${file}`;
const CLIENT = at("client.ts");

describe("findEntriesReachingDatabase", () => {
  it("lists the entries that reach the client, directly, through a helper or a dynamic import, and whether each opens it", async () => {
    const reaching = await findEntriesReachingDatabase({
      entries: [at("server.ts"), at("script-ok.ts"), at("script-bad.ts"), at("script-lazy.ts"), at("pure.ts")],
      clientModule: CLIENT,
    });

    expect(reaching).toEqual([
      { entry: at("server.ts"), opens: true },
      { entry: at("script-ok.ts"), opens: true },
      { entry: at("script-bad.ts"), opens: false },
      { entry: at("script-lazy.ts"), opens: false },
    ]);
  });

  it("counts the app's own opening helper when it is listed in opens", async () => {
    const reaching = await findEntriesReachingDatabase({
      entries: [at("script-lazy.ts")],
      clientModule: CLIENT,
      opens: [/\bopenConfiguredDatabase\s*\(/],
    });

    expect(reaching).toEqual([{ entry: at("script-lazy.ts"), opens: true }]);
  });

  it("resolves entries relative to workingDir and reports them as given", async () => {
    const reaching = await findEntriesReachingDatabase({ entries: ["script-bad.ts", "pure.ts"], clientModule: "client.ts", workingDir: ENTRIES_DIR });

    expect(reaching).toEqual([{ entry: "script-bad.ts", opens: false }]);
  });

  it("names the operation when an entry cannot be built", async () => {
    await expect(findEntriesReachingDatabase({ entries: [at("missing-entry.ts")], clientModule: CLIENT })).rejects.toThrow(
      "findEntriesReachingDatabase: esbuild could not follow the entries' imports",
    );
  });

  it("throws when the client module does not exist", async () => {
    await expect(findEntriesReachingDatabase({ entries: [at("server.ts")], clientModule: at("missing.ts") })).rejects.toThrow(
      "findEntriesReachingDatabase: the client module does not exist",
    );
  });
});

describe("expectEntriesOpenDatabase", () => {
  it("throws naming only the entries that reach the client without opening it", async () => {
    const check = expectEntriesOpenDatabase({ entries: [at("server.ts"), at("script-bad.ts"), at("pure.ts")], clientModule: CLIENT });

    await expect(check).rejects.toThrow(
      "These entries reach the database client without opening it (call withDatabase() or open() at the entry):\n" +
        `  - ${at("script-bad.ts")}`,
    );
  });

  it("passes when every reaching entry opens the database", async () => {
    await expect(
      expectEntriesOpenDatabase({ entries: [at("server.ts"), at("script-ok.ts"), at("pure.ts")], clientModule: CLIENT }),
    ).resolves.toBeUndefined();
  });
});
