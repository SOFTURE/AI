// `softure-mail`: the campaign command over a database connection and the DNS check.
import { fileURLToPath } from "node:url";
import { getRecipientKey } from "@softure-ai/mailing/server";
import { DEFAULT_PAUSE_MS, runMailCli, runMailCommand, type CliOutput, type RunMailCliOptions } from "@softure-ai/mailing/cli";
import { fakeMailProvider, type FakeMailProvider } from "@softure-ai/mailing/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createConfig, createTestMailing, NOW, SECRET, type TestMailing } from "./support.js";

const CAMPAIGN_DIR = fileURLToPath(new URL("./fixtures/campaign/", import.meta.url));
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

    expect(result).toEqual({
      code: 0,
      lines: ["campaign 2026-10-launch (newsletter), dry run: nothing sent or written", "recipients 3, already done 0, unsubscribed 1, filtered out 0, uncertain 0, to send 2"],
      errors: [],
    });
    expect(provider.sent).toEqual([]);
    expect((await test.database.client.query("SELECT 1 FROM mailing.campaigns")).rows).toEqual([]);
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
    await test.database.client.query("DROP TABLE mailing.deliveries");
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
    [[], "missing command; use campaign or dns"],
    [["send"], 'unknown command "send"; use campaign or dns'],
    [["campaign", "--recipients", "recipients.txt"], "campaign needs a content file"],
    [["campaign", "launch.md"], "campaign needs --recipients <file>"],
    [["campaign", "a.md", "b.md", "--recipients", "r.txt"], 'campaign takes one content file, got also "b.md"'],
    [[...SEND, "--pause-ms=-1"], '--pause-ms expects whole milliseconds from 0 to 60000, got "-1"'],
    [[...SEND, "--pause-ms", "fast"], '--pause-ms expects whole milliseconds from 0 to 60000, got "fast"'],
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

  it("needs a domain or the config", async () => {
    expect(await run(["dns"], { config: undefined })).toMatchObject({ code: 1, errors: ["softure-mail dns: pass --domain <domain>, or run it with the app's config to check the sender's domain"] });
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
