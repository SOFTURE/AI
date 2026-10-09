// `softure-mail`: the campaign command over a database connection and the DNS check.
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { mailingMessages } from "@softure-ai/mailing";
import { getRecipientKey, signRecipientKey } from "@softure-ai/mailing/server";
import { DEFAULT_PAUSE_MS, runMailCli, runMailCommand, type CliOutput, type RunMailCliOptions } from "@softure-ai/mailing/cli";
import { fakeMailProvider, type FakeMailProvider } from "@softure-ai/mailing/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createConfig, createTestMailing, NOW, SECRET, type TestMailing } from "./support.js";

const CAMPAIGN_DIR = fileURLToPath(new URL("./fixtures/campaign/", import.meta.url));
const HISTORY_DIR = fileURLToPath(new URL("./fixtures/history/", import.meta.url));
const APP_DIR = fileURLToPath(new URL("./fixtures/app/", import.meta.url));
const ENV = { MAILING_UNSUBSCRIBE_SECRET: SECRET };
const SEND = ["campaign", "launch.md", "--recipients", "recipients.txt"];

function createOutput(): { output: CliOutput; lines: string[]; errors: string[] } {
  const lines: string[] = [];
  const errors: string[] = [];
  return { lines, errors, output: { log: (line) => lines.push(line), error: (line) => errors.push(line) } };
}

describe("softure-mail campaign", () => {
  let provider: FakeMailProvider;
  let test: TestMailing;
  let closed: number;
  let sleep: ReturnType<typeof vi.fn<(ms: number) => Promise<void>>>;

  beforeEach(async () => {
    provider = fakeMailProvider();
    test = await createTestMailing(createConfig(provider));
    closed = 0;
    sleep = vi.fn(() => Promise.resolve());
    vi.stubEnv("MAILING_UNSUBSCRIBE_SECRET", SECRET);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(async () => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    await test.database.close();
  });

  async function run(argv: string[], options: Partial<RunMailCliOptions> = {}) {
    const { output, lines, errors } = createOutput();
    const code = await runMailCli({
      config: test.config,
      argv,
      cwd: CAMPAIGN_DIR,
      output,
      env: ENV,
      sleep,
      // The test database stays open across runs; the command closes only its own handle.
      openDatabase: () => Promise.resolve({ kind: "pglite", db: test.database.db, client: test.database.client, close: () => Promise.resolve(void (closed += 1)) }),
      ...options,
    });
    return { code, lines, errors };
  }

  it("sends the campaign with its HTML body to every recipient, pausing between sends, then closes the connection", async () => {
    const result = await run(SEND);

    expect(result).toEqual({
      code: 0,
      lines: ["campaign 2026-10-launch (newsletter): recipients 3, sent 3, rejected 0, already done 0, in flight 0, retry later 0, filtered out 0, uncertain 0"],
      errors: [],
    });
    expect(provider.sent.map((mail) => mail.to)).toEqual(["ada@example.org", "bob@example.org", "cy@example.org"]);
    expect(provider.sent[0]).toMatchObject({ subject: "Something new", from: "Example <hello@mail.example.com>" });
    expect(provider.sent[0]?.text.startsWith("Hello,\n\nwe shipped something.\n")).toBe(true);
    expect(provider.sent[0]?.html?.startsWith("<p>Hello, we shipped something.</p>")).toBe(true);
    expect(sleep.mock.calls).toEqual([[DEFAULT_PAUSE_MS], [DEFAULT_PAUSE_MS], [DEFAULT_PAUSE_MS]]);
    expect(closed).toBe(1);
  });

  it("sends nothing on a second run and reports the recipients as done", async () => {
    await run(SEND);
    const again = await run([...SEND, "--pause-ms", "0"]);

    expect(again.lines).toEqual(["campaign 2026-10-launch (newsletter): recipients 3, sent 0, rejected 0, already done 3, in flight 0, retry later 0, filtered out 0, uncertain 0"]);
    expect(provider.sent).toHaveLength(3);
  });

  it("names the rejections, and fails while recipients wait for a retry", async () => {
    await test.database.client.query("INSERT INTO mailing.suppressions VALUES ($1, 'page', $2)", [getRecipientKey("ada@example.org"), NOW]);
    const failing = fakeMailProvider({ respond: (message) => (message.to === "cy@example.org" ? { status: "unavailable" } : undefined) });
    const result = await run(SEND, { config: createConfig(failing) });

    expect(result).toEqual({
      code: 1,
      lines: ["campaign 2026-10-launch (newsletter): recipients 3, sent 1, rejected 1 (suppressed 1), already done 0, in flight 0, retry later 1, filtered out 0, uncertain 0"],
      errors: ["1 recipient(s) have no outcome yet; run the same command again later"],
    });
  });

  it("stops at a refused API key, says why, and sends the rest on the next run", async () => {
    const refusing = fakeMailProvider({ respond: () => ({ status: "refused", httpStatus: 401 }) });
    const result = await run(SEND, { config: createConfig(refusing) });

    expect(result).toEqual({
      code: 1,
      lines: ["campaign 2026-10-launch (newsletter): recipients 1, sent 0, rejected 0, already done 0, in flight 0, retry later 1, filtered out 0, uncertain 0"],
      errors: [
        "stopped: the provider refused the account (check the API key and the account) (HTTP 401); the remaining recipients were not touched, run the same command again once it is fixed",
      ],
    });
    expect(await run(SEND)).toMatchObject({ code: 0, lines: ["campaign 2026-10-launch (newsletter): recipients 3, sent 3, rejected 0, already done 0, in flight 0, retry later 0, filtered out 0, uncertain 0"] });
  });

  it("names a spent quota", async () => {
    const spent = fakeMailProvider({ respond: () => ({ status: "quota_exceeded", httpStatus: 429 }) });
    expect((await run(SEND, { config: createConfig(spent) })).errors[0]).toMatch(/^stopped: the account's sending quota is spent \(HTTP 429\)/);
  });

  it("leaves uncertain recipients alone and fails until told to resend them", async () => {
    // A first run registers the campaign; then bob's delivery is an interrupted claim from two days ago.
    await run(SEND);
    provider.clear();
    await test.database.client.query("UPDATE mailing.deliveries SET status = 'claimed', provider_message_id = NULL, finished_at = NULL, claimed_at = $1 WHERE recipient_key = $2", [
      new Date(NOW.getTime() - 48 * 3_600_000),
      getRecipientKey("bob@example.org"),
    ]);

    const dryRun = await run([...SEND, "--dry-run"]);
    expect(dryRun.lines[1]).toBe("recipients 3, already done 2, unsubscribed 0, filtered out 0, uncertain 1, to send 0");
    const waiting = await run(SEND);
    expect(waiting.code).toBe(1);
    expect(waiting.errors).toEqual([
      "1 recipient(s) are uncertain: a send was interrupted long ago and may have gone out; check the provider's log, then run again with --resend-uncertain to send them anyway",
    ]);
    expect(provider.sent).toEqual([]);

    const resent = await run([...SEND, "--resend-uncertain"]);
    expect(resent.code).toBe(0);
    expect(provider.sent.map((mail) => mail.to)).toEqual(["bob@example.org"]);
  });

  it("counts without sending or writing on a dry run", async () => {
    await test.database.client.query("INSERT INTO mailing.suppressions VALUES ($1, 'page', $2)", [getRecipientKey("bob@example.org"), NOW]);
    const result = await run([...SEND, "--dry-run"]);

    expect(result).toMatchObject({ code: 0, errors: [] });
    expect(result.lines.slice(0, 2)).toEqual(["campaign 2026-10-launch (newsletter), dry run: nothing sent or written", "recipients 3, already done 0, unsubscribed 1, filtered out 0, uncertain 0, to send 2"]);
    expect(provider.sent).toEqual([]);
    expect((await test.database.client.query("SELECT 1 FROM mailing.campaigns")).rows).toEqual([]);
  });

  it("sends at most --limit recipients, says how many are left, and succeeds", async () => {
    const result = await run([...SEND, "--limit", "2"]);
    expect(result).toEqual({
      code: 0,
      lines: [
        "campaign 2026-10-launch (newsletter): recipients 3, sent 2, rejected 0, already done 0, in flight 0, retry later 0, filtered out 0, uncertain 0",
        "limit reached: 1 recipient(s) left for the next run",
      ],
      errors: [],
    });
    expect(provider.sent.map((mail) => mail.to)).toEqual(["ada@example.org", "bob@example.org"]);
  });

  it("shows what one limited run would send on a dry run", async () => {
    const result = await run([...SEND, "--dry-run", "--limit", "2"]);
    expect(result.lines.slice(0, 4)).toEqual([
      "campaign 2026-10-launch (newsletter), dry run: nothing sent or written",
      "recipients 3, already done 0, unsubscribed 0, filtered out 0, uncertain 0, to send 3",
      "with --limit 2 this run would send 2",
      "--- preview (addresses masked, link signatures redacted) ---",
    ]);
  });

  it("refuses other content under a campaign id that was sent, in a dry run and for real", async () => {
    await test.database.client.query("INSERT INTO mailing.campaigns VALUES ('2026-10-launch', 'newsletter', 'Old', $1, $2)", ["0".repeat(64), NOW]);
    const message = "campaign 2026-10-launch was sent with other content; give this content a new id";

    expect(await run([...SEND, "--dry-run"])).toMatchObject({ code: 1, errors: [message] });
    expect(await run(SEND)).toMatchObject({ code: 1, errors: [message] });
    expect(provider.sent).toEqual([]);
  });

  it("refuses to send without the unsubscribe secret, before opening the database", async () => {
    const openDatabase = vi.fn();
    const result = await run(SEND, { env: {}, openDatabase });
    expect(result).toMatchObject({ code: 1, errors: ["softure-mail campaign: campaigns are list mail; set MAILING_UNSUBSCRIBE_SECRET (at least 32 characters) to sign their unsubscribe links"] });
    expect(openDatabase).not.toHaveBeenCalled();
  });

  it("lists the problems of a content file that is not a campaign", async () => {
    const result = await run(["campaign", "transactional.md", "--recipients", "recipients.txt"]);
    expect(result.code).toBe(1);
    expect(result.errors).toEqual([
      `softure-mail campaign: ${CAMPAIGN_DIR}transactional.md is not a campaign:\n  kind: a kebab-case list name such as newsletter; campaigns are never transactional`,
    ]);
  });

  it.each([
    [["campaign", "missing.md", "--recipients", "recipients.txt"], `cannot read the content file ${CAMPAIGN_DIR}missing.md`],
    [["campaign", "launch.md", "--recipients", "missing.txt"], `cannot read the recipients file ${CAMPAIGN_DIR}missing.txt`],
  ])("reports a file it cannot read: %j", async (argv, problem) => {
    expect(await run(argv)).toMatchObject({ code: 1, errors: [`softure-mail campaign: ${problem}`] });
  });

  it("reports a database without the mailing tables without the query or its parameters, and closes the connection", async () => {
    await test.database.client.query("DROP TABLE mailing.deliveries CASCADE");
    const result = await run(SEND);
    expect(result.code).toBe(1);
    expect(result.errors).toEqual(['softure-mail campaign: relation "mailing.deliveries" does not exist (did softure migrate run?)']);
    expect(closed).toBe(1);
  });

  it("reports a database it cannot open", async () => {
    const result = await run(SEND, { openDatabase: () => Promise.reject(new Error("connect ECONNREFUSED 127.0.0.1:5432")) });
    expect(result).toMatchObject({ code: 1, errors: ["softure-mail campaign: connect ECONNREFUSED 127.0.0.1:5432"] });
  });

  it.each([
    [[], "missing command; use campaign, test, import or dns"],
    [["send"], 'unknown command "send"; use campaign, test, import or dns'],
    [["campaign", "a.md", "--content-file", "b.md", "--recipients", "r.txt"], "campaign takes the content file once: name it first or with --content-file"],
    [[...SEND, "--kind", "newsletter"], "campaign does not take --kind"],
    [[...SEND, "--preview"], "campaign does not take --preview"],
    [[...SEND, "--inbound", "cloudflare"], "campaign does not take --inbound"],
    [["test", "--dry-run"], "test does not take --dry-run"],
    [["test", "--recipients", "r.txt"], "test does not take --recipients"],
    [["test", "a.md", "b.md"], 'test takes one content file, got also "b.md"'],
    [["import", "a.jsonl", "--kind", "newsletter"], "import does not take --kind"],
    [["import", "a.jsonl", "--content-file", "b.md"], "import does not take --content-file"],
    [["campaign", "--recipients", "recipients.txt"], "campaign needs a content file"],
    [["campaign", "-", "--recipients", "-"], "campaign can read only one of the content file and --recipients from standard input"],
    [["import"], "import needs a history file (- for standard input)"],
    [["import", "a.jsonl", "b.jsonl"], 'import takes one history file, got also "b.jsonl"'],
    [["import", "a.jsonl", "--recipients", "r.txt"], "import does not take --recipients"],
    [["import", "a.jsonl", "--domain", "example.com"], "import does not take --domain"],
    [["campaign", "a.md", "b.md", "--recipients", "r.txt"], 'campaign takes one content file, got also "b.md"'],
    [[...SEND, "--pause-ms=-1"], '--pause-ms expects whole milliseconds from 0 to 60000, got "-1"'],
    [[...SEND, "--pause-ms", "fast"], '--pause-ms expects whole milliseconds from 0 to 60000, got "fast"'],
    [[...SEND, "--limit", "0"], '--limit expects a whole number from 1 to 1000000, got "0"'],
    [[...SEND, "--limit", "many"], '--limit expects a whole number from 1 to 1000000, got "many"'],
    [["import", "a.jsonl", "--limit", "2"], "import does not take --limit"],
    [[...SEND, "--domain", "example.com"], "campaign does not take --domain"],
    [["dns", "--recipients", "r.txt"], "dns does not take --recipients"],
    [["dns", "extra"], 'dns takes no file, got "extra"'],
    [["dns", "--dmarc-policy", "none"], '--dmarc-policy expects quarantine or reject, got "none"'],
    [["dns", "--dmarc-aspf", "strict"], '--dmarc-aspf expects r or s, got "strict"'],
    [[...SEND, "--reply-to", "a@example.com"], "campaign does not take --reply-to"],
    [[...SEND, "--resend-return-path"], "campaign does not take --resend-return-path"],
    [[...SEND, "--force"], "Unknown option '--force'"],
  ])("refuses %j as a usage error", async (argv, problem) => {
    const result = await run(argv);
    expect(result.code).toBe(2);
    expect(result.errors[0]).toContain(`softure-mail: ${problem}`);
    expect(result.errors[1]).toMatch(/^Usage:/);
  });

  it("reads the content file from standard input, with its HTML body in the working directory", async () => {
    const content = await readFile(`${CAMPAIGN_DIR}launch.md`, "utf8");
    const result = await run(["campaign", "-", "--recipients", "recipients.txt"], { readStdin: () => Promise.resolve(content) });

    expect(result).toMatchObject({ code: 0, errors: [] });
    expect(provider.sent).toHaveLength(3);
    expect(provider.sent[0]?.html?.startsWith("<p>Hello, we shipped something.</p>")).toBe(true);
  });

  it("names standard input when the content read from it is not a campaign", async () => {
    const result = await run(["campaign", "-", "--recipients", "recipients.txt"], { readStdin: () => Promise.resolve("hello") });
    expect(result.code).toBe(1);
    expect(result.errors[0]).toMatch(/^softure-mail campaign: standard input is not a campaign:/);
  });

  it("reads the recipients from standard input", async () => {
    const result = await run(["campaign", "launch.md", "--recipients", "-"], { readStdin: () => Promise.resolve("dee@example.org\n# comment\neve@example.org\n") });
    expect(result).toMatchObject({ code: 0, errors: [] });
    expect(provider.sent.map((mail) => mail.to)).toEqual(["dee@example.org", "eve@example.org"]);
  });

  it("takes the recipients from listCampaignRecipients when no file is given", async () => {
    const listCampaignRecipients = vi.fn(async function* () {
      yield "dee@example.org";
      yield await Promise.resolve("eve@example.org");
    });
    const config = createConfig(provider, { listCampaignRecipients });
    const dry = await run(["campaign", "launch.md", "--dry-run"], { config });
    expect(dry.code).toBe(0);
    expect(dry.lines[1]).toBe("recipients 2, already done 0, unsubscribed 0, filtered out 0, uncertain 0, to send 2");

    const result = await run(["campaign", "launch.md"], { config });
    expect(result).toMatchObject({ code: 0, errors: [] });
    expect(provider.sent.map((mail) => mail.to)).toEqual(["dee@example.org", "eve@example.org"]);
    expect(listCampaignRecipients).toHaveBeenCalledWith({ id: "2026-10-launch", kind: "newsletter" }, expect.objectContaining({ config }));
  });

  it("needs a recipients file or listCampaignRecipients, before opening the database", async () => {
    const result = await run(["campaign", "launch.md"]);
    expect(result).toEqual({ code: 1, lines: [], errors: ["softure-mail campaign: pass --recipients <file>, or set listCampaignRecipients in the mailing options"] });
    expect(closed).toBe(0);
  });

  it("imports a history file into the ledger, so the campaign skips those recipients, and imports nothing twice", async () => {
    const first = await run(["import", `${HISTORY_DIR}history.jsonl`]);
    expect(first).toEqual({ code: 0, lines: ["import: rows 2, imported 2, already present 0, duplicates 0"], errors: [] });
    expect(closed).toBe(1);

    const history = await readFile(`${HISTORY_DIR}history.jsonl`, "utf8");
    const again = await run(["import", "-"], { readStdin: () => Promise.resolve(history) });
    expect(again.lines).toEqual(["import: rows 2, imported 0, already present 2, duplicates 0"]);

    const campaign = await run(SEND);
    expect(campaign.lines).toEqual(["campaign 2026-10-launch (newsletter): recipients 3, sent 1, rejected 0, already done 2, in flight 0, retry later 0, filtered out 0, uncertain 0"]);
    expect(provider.sent.map((mail) => mail.to)).toEqual(["cy@example.org"]);
  });

  it("checks a history file on a dry run without opening the database", async () => {
    const history = await readFile(`${HISTORY_DIR}history.jsonl`, "utf8");
    const result = await run(["import", "-", "--dry-run"], { readStdin: () => Promise.resolve(`${history}${history}`) });

    expect(result).toEqual({ code: 0, lines: ["import, dry run: nothing written; rows 4, duplicates 2"], errors: [] });
    expect(closed).toBe(0);
    expect((await test.database.client.query("SELECT 1 FROM mailing.deliveries")).rows).toEqual([]);
  });

  it("lists every problem of a history file by line, without the address, and writes nothing", async () => {
    const lines = [
      '{"scope":"campaign:x","address":"ada@example.org","status":"sent","finishedAt":"2026-09-20T10:15:00Z"}',
      "not json",
      '{"scope":"campaign:x","address":"secret@example.org","status":"bounced","finishedAt":"2026-09-20T10:15:00Z","note":"x"}',
      '{"scope":"Campaign X","address":"carl@example.org","status":"sent","finishedAt":"2099-01-01T00:00:00Z"}',
    ];
    const parse = await run(["import", "-"], { readStdin: () => Promise.resolve(lines.slice(0, 3).join("\n")) });
    expect(parse.code).toBe(1);
    expect(parse.errors[0]).toBe("softure-mail import: nothing written, 3 problem(s):");
    expect(parse.errors.slice(1)).toEqual(["  line 2: not a JSON object", expect.stringMatching(/^ {2}line 3: status: /), "  line 3: unknown field(s) note"]);
    expect(parse.errors.join("\n")).not.toContain("secret@example.org");

    const rows = await run(["import", "-"], { readStdin: () => Promise.resolve([lines[0], lines[3]].join("\n")) });
    expect(rows).toEqual({
      code: 1,
      lines: [],
      errors: [
        "softure-mail import: nothing written, 2 problem(s):",
        "  line 2: scope must be lowercase letters, digits and ._:- (at most 128 characters)",
        "  line 2: finishedAt must not be in the future",
      ],
    });
    expect((await test.database.client.query("SELECT 1 FROM mailing.deliveries")).rows).toEqual([]);
    expect(closed).toBe(0);
  });

  it("reports a history file it cannot read", async () => {
    const result = await run(["import", "missing.jsonl"]);
    expect(result).toEqual({ code: 1, lines: [], errors: [`softure-mail import: cannot read the history file ${CAMPAIGN_DIR}missing.jsonl`] });
  });

  it("prints the mail as the test address gets it on a dry run, address masked and signatures redacted", async () => {
    const result = await run([...SEND, "--dry-run"], { config: createConfig(provider, { testAddress: "operator@example.com" }) });
    const key = getRecipientKey("operator@example.com");

    expect(result.code).toBe(0);
    expect(result.lines.slice(2)).toEqual([
      "--- preview (addresses masked, link signatures redacted) ---",
      "From: Example <hello@mail.example.com>",
      "To: o*******@example.com",
      "Reply-To: s******@example.com",
      "Subject: Something new",
      `List-Unsubscribe: <https://app.example.com/api/mailing/unsubscribe?r=${key}&t=<signature>>`,
      "List-Unsubscribe-Post: List-Unsubscribe=One-Click",
      "",
      "--- text ---",
      "Hello,",
      "",
      "we shipped something.",
      "",
      "-- ",
      "Don't want these emails? Unsubscribe here:",
      `https://app.example.com/unsubscribe?r=${key}&t=<signature>`,
      "--- html ---",
      "<p>Hello, we shipped something.</p>",
      "",
      `<p>Don't want these emails? <a href="https://app.example.com/unsubscribe?r=${key}&amp;t=<signature>">Unsubscribe</a></p>`,
      "--- end of preview ---",
    ]);
    expect(result.lines.join("\n")).not.toContain(signRecipientKey(key, SECRET));
  });

  it("previews for a placeholder address without testAddress, and says so when the secret is missing", async () => {
    const placeholder = await run([...SEND, "--dry-run"]);
    expect(placeholder.lines).toContain("To: r********@example.com");

    const noSecret = await run([...SEND, "--dry-run"], { env: {} });
    expect(noSecret).toMatchObject({ code: 0, errors: [] });
    expect(noSecret.lines.slice(2)).toEqual(["no preview: set MAILING_UNSUBSCRIBE_SECRET to render the unsubscribe footer"]);
  });

  it.each([
    ["a signed link in the text body", "Unsubscribe: https://app.example.com/unsubscribe?r=" + "A".repeat(43) + "&t=" + "B".repeat(43), "the text body carries an unsubscribe link"],
    ["the one-click route in the text body", "See https://app.example.com/api/mailing/unsubscribe?x=1", "the text body carries an unsubscribe link"],
    ["the footer copy in the text body", "Hello,\n\n-- \nDon't want these emails? Unsubscribe here:", "the text body carries the unsubscribe footer"],
    ["the Polish footer copy", mailingMessages.pl.footer.text, "the text body carries the unsubscribe footer"],
  ])("refuses a campaign with %s before opening the database", async (_case, body, problem) => {
    const content = `---\nid: 2026-10-pasted\nkind: newsletter\nsubject: Pasted\n---\n${body}\n`;
    const result = await run(["campaign", "-", "--recipients", "recipients.txt"], { readStdin: () => Promise.resolve(content) });

    expect(result.code).toBe(1);
    expect(result.errors).toEqual([`softure-mail campaign: standard input cannot be sent:\n  ${problem}; ${problem.includes("link") ? "the module adds a link signed for each recipient" : "the module adds it to every mail"}, remove the pasted one`]);
    expect(closed).toBe(0);
    expect(provider.sent).toEqual([]);
  });

  it("resolves a kind alias of the content file and stores the campaign under the kind it names", async () => {
    const content = "---\nid: 2026-10-alias\nkind: news\nsubject: Aliased\n---\nHello.\n";
    const config = createConfig(provider, { kindAliases: { news: "newsletter" } });
    const result = await run(["campaign", "-", "--recipients", "recipients.txt"], { config, readStdin: () => Promise.resolve(content) });

    expect(result.lines).toEqual(["campaign 2026-10-alias (newsletter): recipients 3, sent 3, rejected 0, already done 0, in flight 0, retry later 0, filtered out 0, uncertain 0"]);
    expect((await test.database.client.query("SELECT kind FROM mailing.campaigns WHERE id = '2026-10-alias'")).rows).toEqual([{ kind: "newsletter" }]);
  });

  it("takes the content file from --content-file, so softure-deploy run can send it on standard input", async () => {
    const result = await run(["campaign", "--content-file=launch.md", "--recipients=recipients.txt", "--pause-ms=0"]);

    expect(result).toMatchObject({ code: 0, errors: [] });
    expect(provider.sent).toHaveLength(3);
  });

  it("shows the help", async () => {
    const result = await run(["--help"]);
    expect(result.code).toBe(0);
    expect(result.lines[0]).toMatch(/^Usage:\n {2}softure-mail campaign/);
  });
});

describe("softure-mail dns", () => {
  const records: Record<string, string[]> = {
    "send.mail.example.com": ["v=spf1 include:amazonses.com ~all"],
    "resend._domainkey.mail.example.com": ["p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC"],
    "_dmarc.example.com": ["v=DMARC1; p=none"],
  };
  const resolveTxt = (host: string) => {
    const answer = records[host];
    return answer === undefined ? Promise.reject(Object.assign(new Error("not found"), { code: "ENOTFOUND" })) : Promise.resolve(answer.map((record) => [record]));
  };

  const mx: Record<string, { exchange: string; priority: number }[]> = {
    "example.com": [{ exchange: "route1.mx.example.net", priority: 10 }],
    "send.mail.example.com": [{ exchange: "feedback-smtp.eu-west-1.amazonses.com", priority: 10 }],
  };
  const cnames: Record<string, string[]> = { "rsend.mail.example.com": ["rsend-euw1.forge.rmta.net"] };
  const notFound = (code: string) => Promise.reject(Object.assign(new Error("not found"), { code }));
  const resolveMx = (host: string) => (mx[host] === undefined ? notFound("ENOTFOUND") : Promise.resolve(mx[host]));
  const resolveCname = (host: string) => (cnames[host] === undefined ? notFound("ENODATA") : Promise.resolve(cnames[host]));

  async function run(argv: string[], options: Partial<RunMailCliOptions> = {}) {
    const { output, lines, errors } = createOutput();
    const code = await runMailCli({ config: createConfig(fakeMailProvider()), argv, output, resolveTxt, resolveMx, resolveCname, ...options });
    return { code, lines, errors };
  }

  it("checks the domain of the configured sender and its reply-to domain, and passes when nothing fails", async () => {
    expect(await run(["dns", "--spf-host", "send.mail.example.com"])).toEqual({
      code: 0,
      lines: [
        "sender domain mail.example.com",
        "SPF   pass  found          send.mail.example.com  v=spf1 include:amazonses.com ~all",
        "DKIM  pass  found          resend._domainkey.mail.example.com  p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC",
        "DMARC warn  monitor-only   _dmarc.example.com  v=DMARC1; p=none",
        "REPLY pass  found          example.com  10 route1.mx.example.net",
        "receivers can authenticate mail from this domain",
      ],
      errors: [],
    });
  });

  it("fails and prints failed checks as errors", async () => {
    const result = await run(["dns", "--domain", "other.example.net", "--dkim-selector", "s1"], { config: undefined });
    expect(result.code).toBe(1);
    expect(result.errors).toEqual([
      "SPF   fail  missing        other.example.net",
      "DKIM  fail  missing        s1._domainkey.other.example.net",
      "DMARC fail  missing        _dmarc.other.example.net",
    ]);
    expect(result.lines.at(-1)).toBe("3 check(s) failed: list mail from this domain will land in spam or be refused");
  });

  it("fails a DMARC record weaker than required", async () => {
    const result = await run(["dns", "--spf-host", "send.mail.example.com", "--dmarc-policy", "Reject", "--dmarc-adkim", "s"]);
    expect(result.code).toBe(1);
    expect(result.errors).toEqual(["DMARC fail  weak           _dmarc.example.com  v=DMARC1; p=none"]);
    expect(result.lines.at(-1)).toBe("1 check(s) failed: list mail from this domain will land in spam or be refused");
  });

  it("checks an explicit reply-to and names a bouncing reply path", async () => {
    const result = await run(["dns", "--spf-host", "send.mail.example.com", "--reply-to", "Support <help@replies.example.org>"]);
    expect(result.code).toBe(1);
    expect(result.errors).toEqual(["REPLY fail  missing        replies.example.org"]);
    expect(result.lines.at(-1)).toBe("the reply-to domain does not accept mail: replies will bounce");
  });

  it("checks no reply path with --domain unless --reply-to is given", async () => {
    const result = await run(["dns", "--domain", "mail.example.com", "--spf-host", "send.mail.example.com"]);
    expect(result.lines.some((line) => line.startsWith("REPLY"))).toBe(false);
  });

  it("checks Resend's return-path hosts and other given hosts", async () => {
    const result = await run(["dns", "--spf-host", "send.mail.example.com", "--resend-return-path", "--return-path", "bounces.mail.example.com"]);
    expect(result.code).toBe(1);
    expect(result.lines).toContain("PATH  pass  found          rsend.mail.example.com  rsend-euw1.forge.rmta.net");
    expect(result.lines).toContain("PATH  pass  found          send.mail.example.com  10 feedback-smtp.eu-west-1.amazonses.com");
    expect(result.errors).toEqual(["PATH  fail  missing        bounces.mail.example.com"]);
    expect(result.lines.at(-1)).toBe("1 return-path host(s) failed: the provider cannot use them for bounces");
  });

  it("keeps a space after a long finding", async () => {
    cnames["send.mail.example.com"] = ["send.elsewhere.example"];
    try {
      const result = await run(["dns", "--spf-host", "send.mail.example.com", "--resend-return-path"]);
      expect(result.errors).toEqual(["PATH  fail  unexpected-target send.mail.example.com  send.elsewhere.example"]);
    } finally {
      delete cnames["send.mail.example.com"];
    }
  });

  it("checks Cloudflare Email Routing on the reply-to domain with --inbound cloudflare", async () => {
    mx["example.com"] = [{ exchange: "route1.mx.cloudflare.net", priority: 10 }];
    records["example.com"] = ["v=spf1 include:_spf.mx.cloudflare.net ~all"];
    try {
      const passing = await run(["dns", "--spf-host", "send.mail.example.com", "--inbound", "Cloudflare"]);
      expect(passing.code).toBe(0);
      expect(passing.lines.slice(-3)).toEqual([
        "INBOUND pass  found          example.com  10 route1.mx.cloudflare.net",
        "INBOUND pass  found          example.com  v=spf1 include:_spf.mx.cloudflare.net ~all",
        "receivers can authenticate mail from this domain",
      ]);

      records["example.com"] = ["v=spf1 include:amazonses.com ~all"];
      const failing = await run(["dns", "--spf-host", "send.mail.example.com", "--inbound", "cloudflare"]);
      expect(failing.code).toBe(1);
      expect(failing.errors).toEqual(["INBOUND fail  missing-include example.com  v=spf1 include:amazonses.com ~all"]);
      expect(failing.lines.at(-1)).toBe("the inbound service does not receive this domain's mail: replies will not reach it");
    } finally {
      mx["example.com"] = [{ exchange: "route1.mx.example.net", priority: 10 }];
      delete records["example.com"];
    }
  });

  it("refuses an inbound service it does not know", async () => {
    const result = await run(["dns", "--inbound", "gmail"]);
    expect(result.code).toBe(2);
    expect(result.errors[0]).toBe('softure-mail: --inbound expects cloudflare, got "gmail"');
  });

  it("needs a domain or the config", async () => {
    expect(await run(["dns"], { config: undefined })).toMatchObject({ code: 1, errors: ["softure-mail dns: pass --domain <domain>, or run it with the app's config to check the sender's domain"] });
  });
});

describe("softure-mail test", () => {
  const TEST_ADDRESS = "operator@example.com";
  let provider: FakeMailProvider;
  let test: TestMailing;
  let opened: number;

  beforeEach(async () => {
    provider = fakeMailProvider();
    test = await createTestMailing(createConfig(provider, { testAddress: TEST_ADDRESS, kindAliases: { news: "newsletter" } }));
    opened = 0;
    vi.stubEnv("MAILING_UNSUBSCRIBE_SECRET", SECRET);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(async () => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    await test.database.close();
  });

  async function run(argv: string[], options: Partial<RunMailCliOptions> = {}) {
    const { output, lines, errors } = createOutput();
    const code = await runMailCli({
      config: test.config,
      argv,
      cwd: CAMPAIGN_DIR,
      output,
      env: ENV,
      openDatabase: () => {
        opened += 1;
        return Promise.resolve({ kind: "pglite", db: test.database.db, client: test.database.client, close: () => Promise.resolve() });
      },
      ...options,
    });
    return { code, lines, errors };
  }

  it("sends the fixed test mail to the test address only, as transactional mail, without the database", async () => {
    const result = await run(["test"]);

    expect(result).toEqual({ code: 0, lines: [`test mail (transactional) sent to o*******@example.com; provider message id ${provider.sent[0]?.id ?? ""}`], errors: [] });
    expect(provider.sent.map((mail) => [mail.to, mail.subject, mail.headers])).toEqual([[TEST_ADDRESS, "softure-mail test", {}]]);
    expect(opened).toBe(0);
  });

  it("sends a campaign file's content as list mail with the footer, outside the ledger, so it can be sent again", async () => {
    expect((await run(["test", "launch.md"])).code).toBe(0);
    expect((await run(["test", "--content-file=launch.md"])).code).toBe(0);

    expect(provider.sent.map((mail) => mail.to)).toEqual([TEST_ADDRESS, TEST_ADDRESS]);
    expect(provider.sent[0]).toMatchObject({ subject: "Something new", headers: { "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } });
    expect(provider.sent[0]?.text).toContain("https://app.example.com/unsubscribe?r=");
    expect((await test.database.client.query("SELECT 1 FROM mailing.deliveries UNION ALL SELECT 1 FROM mailing.campaigns")).rows).toEqual([]);
    expect(opened).toBe(2);
  });

  it("takes --kind, an alias included", async () => {
    await run(["test", "--kind", "news"]);
    await run(["test", "launch.md", "--kind", "transactional"]);

    expect(provider.sent[0]?.headers).toMatchObject({ "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" });
    expect(provider.sent[1]?.headers).toEqual({});
  });

  it("prints the mail with --preview and sends nothing", async () => {
    const result = await run(["test", "--kind", "newsletter", "--preview"]);

    expect(result.code).toBe(0);
    expect(result.lines.slice(0, 4)).toEqual(["--- preview (addresses masked, link signatures redacted) ---", "From: Example <hello@mail.example.com>", "To: o*******@example.com", "Reply-To: s******@example.com"]);
    expect(result.lines).toContain("This is a test mail from softure-mail. It arrived, so the provider, the sender address and the reply-to work.");
    expect(provider.sent).toEqual([]);
    expect(opened).toBe(0);
  });

  it("reports a test address that unsubscribed, masked", async () => {
    await test.database.client.query("INSERT INTO mailing.suppressions VALUES ($1, 'page', $2)", [getRecipientKey(TEST_ADDRESS), NOW]);
    expect(await run(["test", "--kind", "newsletter"])).toEqual({ code: 1, lines: [], errors: ["test mail (newsletter) to o*******@example.com not sent: suppressed"] });
  });

  it("names the provider's failure with its status", async () => {
    const refusing = fakeMailProvider({ respond: () => ({ status: "refused", httpStatus: 403 }) });
    const result = await run(["test"], { config: createConfig(refusing, { testAddress: TEST_ADDRESS }) });
    expect(result).toEqual({ code: 1, lines: [], errors: ["test mail (transactional) to o*******@example.com not sent: provider_refused (HTTP 403)"] });
  });

  it("refuses to send without testAddress", async () => {
    const result = await run(["test"], { config: createConfig(provider) });
    expect(result).toEqual({ code: 1, lines: [], errors: ["softure-mail test: set testAddress in the mailing options; the test sends to that address only"] });
    expect(provider.sent).toEqual([]);
  });

  it("refuses a list-mail preview without the unsubscribe secret", async () => {
    const result = await run(["test", "--kind", "newsletter", "--preview"], { env: {} });
    expect(result).toEqual({ code: 1, lines: [], errors: ["softure-mail test: set MAILING_UNSUBSCRIBE_SECRET to sign the unsubscribe link of list mail"] });
  });

  it("refuses a kind that is no mail kind", async () => {
    const result = await run(["test", "--kind", "Not A Kind", "--preview"]);
    expect(result).toEqual({ code: 1, lines: [], errors: ["softure-mail test: the mail is invalid (kind)"] });
  });
});

describe("the softure-mail bin", () => {
  async function runBin(argv: string[], cwd = APP_DIR) {
    const { output, lines, errors } = createOutput();
    const code = await runMailCommand({ argv, cwd, output });
    return { code, lines, errors };
  }

  it("loads softure.config.mjs from the working directory", async () => {
    const result = await runBin(["campaign", "../campaign/launch.md", "--recipients", "../campaign/recipients.txt", "--dry-run"]);
    expect(result).toMatchObject({ code: 1 });
    // The in-memory database of the fixture has no tables: the config loaded and the command ran.
    expect(result.errors[0]).toMatch(/^softure-mail campaign: relation "mailing\.campaigns" does not exist/);
  });

  it("needs no config for the help", async () => {
    expect((await runBin(["--help"], CAMPAIGN_DIR)).code).toBe(0);
  });

  it("reports a missing config", async () => {
    expect(await runBin(["campaign", "launch.md", "--recipients", "recipients.txt"], CAMPAIGN_DIR)).toMatchObject({
      code: 1,
      errors: [`softure-mail: no config found; looked for softure.config.ts, softure.config.mts, softure.config.js, softure.config.mjs in ${CAMPAIGN_DIR}; pass --config <file>`],
    });
    expect(await runBin(["dns", "--config", "nowhere.mjs"], CAMPAIGN_DIR)).toMatchObject({ code: 1, errors: [`softure-mail: config file ${CAMPAIGN_DIR}nowhere.mjs does not exist`] });
  });

  it("refuses --config without a path", async () => {
    expect(await runBin(["dns", "--config"])).toMatchObject({ code: 2 });
  });
});
