// Importing an app's own sign-up list: rows with their history, consents at their historical time and
// document version, opt-outs of who unsubscribed (a person's own, which a new sign-up lifts), a repeat
// import that changes nothing, merges that never narrow, and refusals that write nothing and name rows,
// never addresses. Then the import-signups ops script over a JSON file.
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getRecipientKey, isSuppressed } from "@softure-ai/mailing/server";
import { executeOpsScript } from "@softure-ai/ops/scripts";
import { getEmailKey, hasConsent } from "@softure-ai/privacy/server";
import { getSignup, getSignupById, importSignups, joinWaitlist, type ImportSignupRow } from "@softure-ai/waitlist/server";
import { createImportSignupsScript } from "@softure-ai/waitlist/scripts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CLIENT, createTestWaitlist, listConsentRows, NOW, SECRET, type TestWaitlist } from "./support.js";

const ENV = { MAILING_UNSUBSCRIBE_SECRET: SECRET };
const ADA = "ada@example.com";
const BOB = "bob@example.com";
const ADA_ID = "5d4f0a43-8f6a-4c55-9b5e-0d0b8b6f1a01";
const SIGNED_UP = new Date("2026-03-01T10:00:00Z");
const UNSUBSCRIBED = new Date("2026-06-15T18:30:00Z");

const ROW: ImportSignupRow = { id: ADA_ID, email: ADA, scopes: ["launch"], placement: "hero", locale: "pl", signedUpAt: SIGNED_UP };

async function countRows(test: TestWaitlist, table: string): Promise<number> {
  const result = await test.database.client.query<{ total: number }>(`SELECT count(*)::int AS total FROM ${table}`);
  return result.rows[0]?.total ?? -1;
}

async function readSuppression(test: TestWaitlist, email: string): Promise<{ source: string } | undefined> {
  const result = await test.database.client.query<{ source: string }>("SELECT source FROM mailing.suppressions WHERE recipient_key = $1", [getRecipientKey(email)]);
  return result.rows[0];
}

describe("importSignups", () => {
  let test: TestWaitlist;

  beforeEach(async () => {
    test = await createTestWaitlist();
  });
  afterEach(() => test.database.close());

  it("inserts a row with its id, times, locale and channel, and its consent at the historical time and version", async () => {
    const result = await importSignups(test.ctx, [{ ...ROW, scopes: ["newsletter", "launch"], channel: "ads", documentVersions: { "privacy-policy": "2026-01-10" } }], { env: ENV });
    expect(result).toEqual({ ok: true, value: { rows: 1, inserted: 1, updated: 0, unchanged: 0, consentsRecorded: 2, withdrawalsRecorded: 0, optOutsRecorded: 0 } });
    expect(await getSignupById(test.ctx, ADA_ID)).toEqual({
      id: ADA_ID,
      email: ADA,
      scopes: ["launch", "newsletter"],
      placement: "hero",
      locale: "pl",
      createdAt: SIGNED_UP,
      updatedAt: NOW,
      confirmedAt: SIGNED_UP,
      channel: "ads",
    });
    expect(await listConsentRows(test, getEmailKey(ADA))).toEqual([
      { purpose: "launch", granted: true, document_id: "privacy-policy", document_version: "2026-01-10", source: "waitlist-import", recorded_at: SIGNED_UP },
      { purpose: "newsletter", granted: true, document_id: null, document_version: null, source: "waitlist-import", recorded_at: SIGNED_UP },
    ]);
    // A consent to an older version is evidence, not a current consent.
    expect(await hasConsent(test.ctx, { subject: { email: ADA }, purpose: "launch" })).toBe(false);
    expect(test.provider.sent).toEqual([]);
  });

  it("records the configured version without documentVersions, and separate confirmation and consent times", async () => {
    const confirmed = new Date("2026-03-02T08:00:00Z");
    expect(await importSignups(test.ctx, [{ ...ROW, confirmedAt: confirmed }], { env: ENV })).toMatchObject({ ok: true });
    expect(await getSignup(test.ctx, ADA)).toMatchObject({ createdAt: SIGNED_UP, confirmedAt: confirmed });
    expect(await listConsentRows(test, getEmailKey(ADA))).toEqual([
      { purpose: "launch", granted: true, document_id: "privacy-policy", document_version: "2026-09-01", source: "waitlist-import", recorded_at: confirmed },
    ]);
    expect(await hasConsent(test.ctx, { subject: { email: ADA }, purpose: "launch" })).toBe(true);
  });

  it("changes nothing when the same input is imported again", async () => {
    const rows: ImportSignupRow[] = [ROW, { email: BOB, scopes: ["launch", "newsletter"], placement: "footer", locale: "en", signedUpAt: SIGNED_UP, unsubscribedAt: UNSUBSCRIBED }];
    expect(await importSignups(test.ctx, rows, { env: ENV })).toMatchObject({ ok: true, value: { inserted: 2, consentsRecorded: 3, withdrawalsRecorded: 2, optOutsRecorded: 1 } });
    const consents = await countRows(test, "privacy.consents");
    test.clock.set(new Date(NOW.getTime() + 60_000));
    expect(await importSignups(test.ctx, rows, { env: ENV })).toEqual({ ok: true, value: { rows: 2, inserted: 0, updated: 0, unchanged: 2, consentsRecorded: 0, withdrawalsRecorded: 0, optOutsRecorded: 0 } });
    expect(await countRows(test, "privacy.consents")).toBe(consents);
    expect(await getSignup(test.ctx, ADA)).toMatchObject({ updatedAt: NOW });
  });

  it("merges into a sign-up already on the list: scopes widen, earlier times move back, the channel fills, placement and locale stay", async () => {
    await joinWaitlist(test.ctx, { email: ADA, scopes: ["launch"], placement: "footer", clientKey: CLIENT });
    const stored = await getSignup(test.ctx, ADA);
    test.clock.set(new Date(NOW.getTime() + 60_000));
    const result = await importSignups(test.ctx, [{ email: ADA, scopes: ["newsletter"], placement: "hero", locale: "pl", signedUpAt: SIGNED_UP, channel: "blog" }], { env: ENV });
    expect(result).toMatchObject({ ok: true, value: { inserted: 0, updated: 1, consentsRecorded: 1 } });
    expect(await getSignup(test.ctx, ADA)).toEqual({ ...stored, scopes: ["launch", "newsletter"], createdAt: SIGNED_UP, confirmedAt: SIGNED_UP, channel: "blog", updatedAt: new Date(NOW.getTime() + 60_000) });

    // The join's own time and fewer scopes change nothing: that consent is already in the ledger.
    expect(await importSignups(test.ctx, [{ email: ADA, scopes: ["launch"], placement: "hero", locale: "en", signedUpAt: NOW, channel: "ads" }], { env: ENV })).toMatchObject({
      ok: true,
      value: { unchanged: 1, consentsRecorded: 0 },
    });
    expect(await getSignup(test.ctx, ADA)).toMatchObject({ scopes: ["launch", "newsletter"], createdAt: SIGNED_UP, channel: "blog" });
  });

  it("confirms a row still waiting for its link with the imported scopes", async () => {
    test = await createTestWaitlist({ waitlist: { scopes: [{ id: "launch", label: { en: "Launch" } }, { id: "newsletter", label: { en: "News" } }], placements: ["hero"], doubleOptIn: true } });
    await joinWaitlist(test.ctx, { email: ADA, scopes: ["newsletter"], placement: "hero", clientKey: CLIENT });
    // No id: the pending row was stored under a new one.
    expect(await importSignups(test.ctx, [{ email: ADA, scopes: ["launch"], placement: "hero", locale: "pl", signedUpAt: SIGNED_UP }], { env: ENV })).toMatchObject({ ok: true, value: { updated: 1 } });
    expect(await getSignup(test.ctx, ADA)).toMatchObject({ scopes: ["launch"], confirmedAt: SIGNED_UP, createdAt: SIGNED_UP });
  });

  it("records the withdrawals of an unsubscribed row at their time and a page opt-out, which a new sign-up lifts", async () => {
    const result = await importSignups(test.ctx, [{ ...ROW, scopes: ["launch", "newsletter"], unsubscribedAt: UNSUBSCRIBED }], { env: ENV });
    expect(result).toMatchObject({ ok: true, value: { consentsRecorded: 2, withdrawalsRecorded: 2, optOutsRecorded: 1 } });
    expect((await listConsentRows(test, getEmailKey(ADA))).map((row) => [row.purpose, row.granted, row.recorded_at])).toEqual([
      ["launch", true, SIGNED_UP],
      ["newsletter", true, SIGNED_UP],
      ["launch", false, UNSUBSCRIBED],
      ["newsletter", false, UNSUBSCRIBED],
    ]);
    // onUnsubscribed (withdrawWaitlistConsents) found nothing left to withdraw.
    expect(await countRows(test, "privacy.consents")).toBe(4);
    expect(await readSuppression(test, ADA)).toEqual({ source: "page" });
    expect(await getSignup(test.ctx, ADA)).toMatchObject({ scopes: ["launch", "newsletter"] });

    expect(await joinWaitlist(test.ctx, { email: ADA, scopes: ["launch"], placement: "hero", clientKey: CLIENT })).toMatchObject({ ok: true });
    expect(await isSuppressed(test.ctx, ADA)).toBe(false);
    // Imported again after that sign-up: the person wants the mail, so no new opt-out.
    expect(await importSignups(test.ctx, [{ ...ROW, scopes: ["launch", "newsletter"], unsubscribedAt: UNSUBSCRIBED }], { env: ENV })).toMatchObject({ ok: true, value: { optOutsRecorded: 0 } });
    expect(await isSuppressed(test.ctx, ADA)).toBe(false);
  });

  it("refuses unsubscribed rows without the unsubscribe secret, before anything is written", async () => {
    const result = await importSignups(test.ctx, [ROW, { ...ROW, id: undefined, email: BOB, unsubscribedAt: UNSUBSCRIBED }], { env: {} });
    expect(result).toEqual({ ok: false, error: "waitlist.import_invalid", problems: ["MAILING_UNSUBSCRIBE_SECRET is not set (at least 32 characters): the unsubscribed rows need it for their opt-out"] });
    expect(await countRows(test, "waitlist.signups")).toBe(0);
    // Without unsubscribed rows the secret is not needed.
    expect(await importSignups(test.ctx, [ROW], { env: {} })).toMatchObject({ ok: true });
  });

  it("refuses invalid rows by number, never naming an address, and writes nothing", async () => {
    const future = new Date(NOW.getTime() + 1);
    const result = await importSignups(
      test.ctx,
      [
        ROW,
        { email: "not an address", scopes: [], placement: "sidebar", locale: "PL", signedUpAt: SIGNED_UP, id: "17", channel: "with space" },
        { email: BOB, scopes: ["launch", "partners"], placement: "hero", locale: "en", signedUpAt: future },
        { email: "cyd@example.com", scopes: ["launch"], placement: "hero", locale: "en", signedUpAt: SIGNED_UP, confirmedAt: new Date("2026-02-01T00:00:00Z"), unsubscribedAt: SIGNED_UP, consentedAt: new Date("2026-04-01T00:00:00Z") },
        { email: "dan@example.com", scopes: ["launch"], placement: "hero", locale: "en", signedUpAt: SIGNED_UP, documentVersions: { cookies: "v1", terms: "has space" } },
        { ...ROW, email: " ADA@example.com" },
      ],
      { env: ENV },
    );
    expect(result).toEqual({
      ok: false,
      error: "waitlist.import_invalid",
      problems: [
        "row 2: email is not an email address",
        "row 2: id is not a UUID",
        "row 2: scopes is empty",
        'row 2: placement "sidebar" is not declared in waitlist({ placements })',
        "row 2: locale must be two lowercase letters",
        "row 2: channel must be 1-64 visible ASCII characters",
        'row 3: scopes "partners" are not declared in waitlist({ scopes })',
        "row 3: signedUpAt must be a valid time, not after now",
        "row 4: confirmedAt is before signedUpAt",
        "row 4: unsubscribedAt is before consentedAt",
        "and 4 more problems",
      ],
    });
    expect(JSON.stringify(result)).not.toMatch(/example\.com/);
    expect(await countRows(test, "waitlist.signups")).toBe(0);
    expect(await countRows(test, "privacy.consents")).toBe(0);
  });

  it("refuses an empty input, and ids that clash with the list", async () => {
    expect(await importSignups(test.ctx, [], { env: ENV })).toEqual({ ok: false, error: "waitlist.import_invalid", problems: ["the input holds no rows"] });
    await importSignups(test.ctx, [ROW], { env: ENV });
    expect(await importSignups(test.ctx, [{ ...ROW, email: BOB }], { env: ENV })).toEqual({
      ok: false,
      error: "waitlist.import_invalid",
      problems: ["row 1: id belongs to another address on the list"],
    });
    expect(await importSignups(test.ctx, [{ ...ROW, id: "6d4f0a43-8f6a-4c55-9b5e-0d0b8b6f1a02" }], { env: ENV })).toEqual({
      ok: false,
      error: "waitlist.import_invalid",
      problems: ["row 1: the address is on the list under another id"],
    });
    expect(await countRows(test, "waitlist.signups")).toBe(1);
  });
});

describe("the import-signups script", () => {
  let test: TestWaitlist;
  let folder: string;

  async function writeImportFile(content: unknown): Promise<string> {
    const path = join(folder, `import-${String(Math.random()).slice(2)}.json`);
    await writeFile(path, typeof content === "string" ? content : JSON.stringify(content));
    return path;
  }

  function script() {
    return createImportSignupsScript(test.config, { clock: test.clock, env: ENV, scopeAliases: { lists: ["launch", "newsletter"], start: ["launch"] } });
  }

  beforeEach(async () => {
    test = await createTestWaitlist();
    folder = await mkdtemp(join(tmpdir(), "waitlist-import-"));
  });
  afterEach(async () => {
    await test.database.close();
    await rm(folder, { recursive: true, force: true });
    vi.unstubAllEnvs();
  });

  const FILE_ROWS = [
    { id: ADA_ID, email: ADA, scopes: ["lists"], placement: "hero", locale: "pl", signedUpAt: "2026-03-01T11:00:00+01:00", channel: "ads" },
    { email: BOB, scopes: ["start", "launch"], placement: "footer", locale: "en", signedUpAt: "2026-03-02T09:00:00+01:00", unsubscribedAt: "2026-06-15T20:30:00+02:00" },
  ];

  it("writes nothing on a dry run and reports what it would change", async () => {
    const file = await writeImportFile(FILE_ROWS);
    expect(await executeOpsScript(test.database.db, script(), { file }, { commit: false })).toEqual({
      ok: true,
      value: {
        committed: false,
        report: {
          before: { signups: 0 },
          after: { signups: 2, rows: 2, inserted: 2, updated: 0, unchanged: 0, consentsRecorded: 3, withdrawalsRecorded: 1, optOutsRecorded: 1 },
        },
      },
    });
    expect(await countRows(test, "waitlist.signups")).toBe(0);
    expect(await countRows(test, "mailing.suppressions")).toBe(0);
  });

  it("imports with --commit, expanding the app's scope names", async () => {
    const file = await writeImportFile(FILE_ROWS);
    expect(await executeOpsScript(test.database.db, script(), { file }, { commit: true })).toMatchObject({ ok: true, value: { committed: true } });
    expect(await getSignupById(test.ctx, ADA_ID)).toMatchObject({ email: ADA, scopes: ["launch", "newsletter"], createdAt: SIGNED_UP, channel: "ads" });
    expect(await getSignup(test.ctx, BOB)).toMatchObject({ scopes: ["launch"], createdAt: new Date("2026-03-02T08:00:00Z") });
    expect(await readSuppression(test, BOB)).toEqual({ source: "page" });
  });

  it.each([
    ["a missing file", null, /^cannot read the file ".*missing\.json" \(ENOENT\)$/],
    ["invalid JSON", "[{", /^the file ".*" is not valid JSON$/],
    ["an empty array", [], /: the file holds no rows$/],
    ["a time without an offset", [{ ...FILE_ROWS[0], signedUpAt: "2026-03-01" }], /: row 1 signedUpAt: must be an ISO 8601 date-time with an offset/],
    ["an unknown key", [{ ...FILE_ROWS[0], plan: "x" }], /: row 1: Unrecognized key: "plan"$/],
    ["a scope that is neither declared nor an alias", [{ ...FILE_ROWS[0], scopes: ["partners"] }], /^row 1: scopes "partners" are not declared in waitlist\(\{ scopes \}\)$/],
  ])("refuses %s and writes nothing", async (_name, content, reason) => {
    const file = content === null ? join(folder, "missing.json") : await writeImportFile(content);
    const outcome = await executeOpsScript(test.database.db, script(), { file }, { commit: true });
    expect(outcome).toMatchObject({ ok: false, error: "ops.script_refused" });
    if (outcome.ok) return;
    expect(outcome.reason).toMatch(reason);
    expect(await countRows(test, "waitlist.signups")).toBe(0);
  });

  it("reads the secret from the environment by default", async () => {
    vi.stubEnv("MAILING_UNSUBSCRIBE_SECRET", SECRET);
    const file = await writeImportFile(FILE_ROWS);
    const plain = createImportSignupsScript(test.config, { clock: test.clock, scopeAliases: { lists: ["launch", "newsletter"], start: ["launch"] } });
    expect(await executeOpsScript(test.database.db, plain, { file }, { commit: true })).toMatchObject({ ok: true });
    expect(await isSuppressed(test.ctx, BOB)).toBe(true);
  });
});
