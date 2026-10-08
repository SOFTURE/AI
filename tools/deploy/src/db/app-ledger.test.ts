import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { compareAppLedger, quoteTableName, readAppJournal, type AppJournalEntry } from "./app-ledger.js";

const entry = (tag: string, when: number, hash: string | null = `h-${tag}`): AppJournalEntry => ({ tag, when, hash });

describe("compareAppLedger", () => {
  const journal = [entry("0000_init", 100), entry("0001_notes", 200), entry("0002_index", 300)];

  it("lists the entries after the newest applied row as pending, oldest first", () => {
    const result = compareAppLedger(journal, [{ hash: "h-0000_init", createdAt: 100 }]);
    expect(result).toEqual({ ok: true, check: { pending: [journal[1], journal[2]], changed: [] } });
  });

  it("takes an empty ledger as every entry pending", () => {
    expect(compareAppLedger(journal, [])).toEqual({ ok: true, check: { pending: journal, changed: [] } });
  });

  it("passes an image whose entries are all applied", () => {
    const rows = journal.map((item) => ({ hash: item.hash ?? "", createdAt: item.when }));
    expect(compareAppLedger(journal, rows)).toEqual({ ok: true, check: { pending: [], changed: [] } });
  });

  it("refuses an image older than the database: a row no entry of the journal matches", () => {
    const rows = [100, 200, 300, 400].map((createdAt) => ({ hash: "x", createdAt }));
    expect(compareAppLedger(journal, rows)).toEqual({
      ok: false,
      problems: ["app migration applied at 400 is not in the image's journal: the image is older than the database"],
    });
  });

  it("refuses an entry older than the newest applied row, which drizzle would skip for good", () => {
    const rows = [{ hash: "h-0000_init", createdAt: 100 }, { hash: "h-0002_index", createdAt: 300 }];
    expect(compareAppLedger(journal, rows)).toEqual({
      ok: false,
      problems: ["app migration 0001_notes is older than the newest applied one and would never run"],
    });
  });

  it("notes an applied file that changed since it ran, without refusing it", () => {
    const rows = [{ hash: "edited", createdAt: 100 }];
    expect(compareAppLedger(journal, rows)).toEqual({ ok: true, check: { pending: [journal[1], journal[2]], changed: [journal[0]] } });
  });

  it("does not compare the hash of an entry whose file the image lacks", () => {
    expect(compareAppLedger([entry("0000_init", 100, null)], [{ hash: "any", createdAt: 100 }])).toEqual({
      ok: true,
      check: { pending: [], changed: [] },
    });
  });
});

describe("readAppJournal", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "softure-deploy-journal-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("reads the entries and hashes each SQL file the way drizzle does (the whole text)", () => {
    mkdirSync(join(dir, "meta"));
    const sql = "CREATE TABLE notes (id int);\n--> statement-breakpoint\nCREATE INDEX x ON notes (id);\n";
    writeFileSync(join(dir, "0000_init.sql"), sql);
    writeFileSync(
      join(dir, "meta", "_journal.json"),
      JSON.stringify({ version: "7", dialect: "postgresql", entries: [{ idx: 0, version: "7", when: 1700000000000, tag: "0000_init", breakpoints: true }, { idx: 1, when: 1700000000001, tag: "0001_gone" }] }),
    );
    expect(readAppJournal(dir)).toEqual({
      ok: true,
      entries: [
        { tag: "0000_init", when: 1700000000000, hash: createHash("sha256").update(sql).digest("hex") },
        { tag: "0001_gone", when: 1700000000001, hash: null },
      ],
    });
  });

  it("names a missing or invalid journal", () => {
    expect(readAppJournal(dir)).toEqual({ ok: false, problem: "cannot read meta/_journal.json of the app migrations (ENOENT)" });
    mkdirSync(join(dir, "meta"));
    writeFileSync(join(dir, "meta", "_journal.json"), "{");
    expect(readAppJournal(dir)).toEqual({ ok: false, problem: "cannot read meta/_journal.json of the app migrations (not valid JSON)" });
    writeFileSync(join(dir, "meta", "_journal.json"), JSON.stringify({ entries: [{ tag: "../x", when: 1 }] }));
    expect(readAppJournal(dir)).toMatchObject({ ok: false, problem: expect.stringContaining("is not a drizzle journal") as unknown });
  });
});

describe("quoteTableName", () => {
  it("quotes each part of a valid name and throws on anything else", () => {
    expect(quoteTableName("drizzle.__drizzle_migrations")).toBe('"drizzle"."__drizzle_migrations"');
    expect(() => quoteTableName('x"; drop')).toThrow("not a table name");
  });
});
