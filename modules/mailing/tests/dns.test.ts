// The sender DNS check: SPF, DKIM and DMARC from TXT records; the reply domain's MX; the return-path hosts.
import { checkSenderDns, getSenderDomain, resendReturnPath, type MxRecord, type ResolveCname, type ResolveMx, type ResolveTxt, type ReturnPathHost } from "@softure-ai/mailing/server";
import { describe, expect, it } from "vitest";

const SPF = "v=spf1 include:amazonses.com ~all";
const DKIM = "p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC";
const DMARC = "v=DMARC1; p=quarantine; rua=mailto:dmarc@example.com";

function dnsError(code: string): Error {
  return Object.assign(new Error(`queryTxt ${code}`), { code });
}

/** Answers every name with ENOTFOUND, for the record types a test does not look at. */
const nothing = () => Promise.reject(dnsError("ENOTFOUND"));

/** An MX resolver over a fixed zone. */
function mxZone(records: Record<string, MxRecord[] | Error>): ResolveMx {
  return (host) => {
    const answer = records[host];
    if (answer === undefined) return Promise.reject(dnsError("ENOTFOUND"));
    return answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer);
  };
}

/** A CNAME resolver over a fixed zone; a name without a CNAME answers ENODATA, as Node does. */
function cnameZone(records: Record<string, string[] | Error>): ResolveCname {
  return (host) => {
    const answer = records[host];
    if (answer === undefined) return Promise.reject(dnsError("ENODATA"));
    return answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer);
  };
}

/** A resolver over a fixed zone; names it does not know answer ENOTFOUND. */
function zone(records: Record<string, string[] | Error>): ResolveTxt {
  return (host) => {
    const answer = records[host];
    if (answer === undefined) return Promise.reject(dnsError("ENOTFOUND"));
    if (answer instanceof Error) return Promise.reject(answer);
    // Long records arrive in chunks; the check joins them.
    return Promise.resolve(answer.map((record) => [record.slice(0, 10), record.slice(10)]));
  };
}

describe("checkSenderDns", () => {
  it("passes a domain with SPF, a DKIM key under the resend selector and an enforcing DMARC policy", async () => {
    const resolveTxt = zone({ "mail.example.com": ["google-site-verification=x", SPF], "resend._domainkey.mail.example.com": [DKIM], "_dmarc.mail.example.com": [DMARC] });
    expect(await checkSenderDns("Mail.Example.com.", { resolveTxt })).toEqual({
      domain: "mail.example.com",
      spf: { status: "pass", finding: "found", host: "mail.example.com", record: SPF },
      dkim: { status: "pass", finding: "found", host: "resend._domainkey.mail.example.com", record: DKIM },
      dmarc: { status: "pass", finding: "found", host: "_dmarc.mail.example.com", record: DMARC },
      replyTo: null,
      returnPath: [],
    });
  });

  it("fails all three when nothing is published", async () => {
    expect(await checkSenderDns("example.com", { resolveTxt: zone({}) })).toEqual({
      domain: "example.com",
      spf: { status: "fail", finding: "missing", host: "example.com", record: null },
      dkim: { status: "fail", finding: "missing", host: "resend._domainkey.example.com", record: null },
      dmarc: { status: "fail", finding: "missing", host: "_dmarc.example.com", record: null },
      replyTo: null,
      returnPath: [],
    });
  });

  describe("SPF", () => {
    it("looks at the given hosts in order (Resend publishes it on send.<domain>)", async () => {
      const report = await checkSenderDns("example.com", { spfHosts: ["example.com", "send.example.com"], resolveTxt: zone({ "send.example.com": [SPF] }) });
      expect(report.spf).toEqual({ status: "pass", finding: "found", host: "send.example.com", record: SPF });
    });

    it("fails two SPF records on one host (a permerror for receivers)", async () => {
      expect((await checkSenderDns("example.com", { resolveTxt: zone({ "example.com": [SPF, "v=spf1 -all"] }) })).spf).toMatchObject({ status: "fail", finding: "multiple" });
    });

    it.each(["v=spf1 +all", "v=spf1 a all"])("warns about %s, which lets anyone send as the domain", async (record) => {
      expect((await checkSenderDns("example.com", { resolveTxt: zone({ "example.com": [record] }) })).spf).toMatchObject({ status: "warn", finding: "permissive", record });
    });

    it("reports a lookup that failed for another reason than a missing name", async () => {
      expect((await checkSenderDns("example.com", { resolveTxt: zone({ "example.com": dnsError("ESERVFAIL") }) })).spf).toEqual({ status: "fail", finding: "lookup-failed", host: "example.com", record: null });
    });
  });

  describe("DKIM", () => {
    it("tries every selector and reports the first key found", async () => {
      const report = await checkSenderDns("example.com", { dkimSelectors: ["resend", "s1"], resolveTxt: zone({ "s1._domainkey.example.com": [`v=DKIM1; k=rsa; ${DKIM}`] }) });
      expect(report.dkim).toMatchObject({ status: "pass", host: "s1._domainkey.example.com" });
    });

    it("fails a revoked key (an empty p=)", async () => {
      expect((await checkSenderDns("example.com", { resolveTxt: zone({ "resend._domainkey.example.com": ["v=DKIM1; p="] }) })).dkim).toMatchObject({ status: "fail", finding: "revoked" });
    });
  });

  describe("DMARC", () => {
    it("warns about p=none, which only reports", async () => {
      expect((await checkSenderDns("example.com", { resolveTxt: zone({ "_dmarc.example.com": ["v=DMARC1; p=none"] }) })).dmarc).toMatchObject({ status: "warn", finding: "monitor-only" });
    });

    it("falls back to the parent domain's policy, with sp= for subdomains", async () => {
      const resolveTxt = zone({ "_dmarc.example.com": ["v=DMARC1; p=reject; sp=none"] });
      expect((await checkSenderDns("mail.example.com", { resolveTxt })).dmarc).toMatchObject({ status: "warn", finding: "monitor-only", host: "_dmarc.example.com" });
      const enforcing = zone({ "_dmarc.example.com": ["v=DMARC1; p=reject"] });
      expect((await checkSenderDns("mail.example.com", { resolveTxt: enforcing })).dmarc).toMatchObject({ status: "pass", finding: "inherited", host: "_dmarc.example.com" });
    });

    it("never asks for the policy of a top-level domain", async () => {
      const asked: string[] = [];
      await checkSenderDns("example.com", { resolveTxt: (host) => (asked.push(host), Promise.reject(dnsError("ENODATA"))) });
      expect(asked.filter((host) => host.startsWith("_dmarc"))).toEqual(["_dmarc.example.com"]);
    });

    it("fails two DMARC records", async () => {
      expect((await checkSenderDns("example.com", { resolveTxt: zone({ "_dmarc.example.com": [DMARC, DMARC] }) })).dmarc).toMatchObject({ status: "fail", finding: "multiple" });
    });
  });

  describe("required DMARC policy", () => {
    const STRICT = "v=DMARC1; p=reject; sp=reject; adkim=s; aspf=s";
    const expectDmarc = { policy: "reject", subdomainPolicy: "reject", adkim: "s", aspf: "s" } as const;
    const dmarcOf = async (domain: string, records: Record<string, string[]>, expected: Parameters<typeof checkSenderDns>[1] = { expectDmarc }) =>
      (await checkSenderDns(domain, { ...expected, resolveTxt: zone(records) })).dmarc;

    it("passes the record that meets every requirement", async () => {
      expect(await dmarcOf("example.com", { "_dmarc.example.com": [STRICT] })).toEqual({ status: "pass", finding: "found", host: "_dmarc.example.com", record: STRICT });
    });

    it.each([
      ["a quarantine policy where reject is required", "v=DMARC1; p=quarantine; sp=reject; adkim=s; aspf=s"],
      ["p=none", "v=DMARC1; p=none; sp=reject; adkim=s; aspf=s"],
      ["relaxed DKIM alignment", "v=DMARC1; p=reject; sp=reject; adkim=r; aspf=s"],
      ["relaxed SPF alignment", "v=DMARC1; p=reject; sp=reject; adkim=s; aspf=r"],
      ["alignment left out (relaxed by default)", "v=DMARC1; p=reject; sp=reject"],
      ["a weaker subdomain policy", "v=DMARC1; p=reject; sp=quarantine; adkim=s; aspf=s"],
      ["a policy applied to part of the mail", "v=DMARC1; p=reject; sp=reject; adkim=s; aspf=s; pct=50"],
      ["an unknown policy value", "v=DMARC1; p=strict; sp=reject; adkim=s; aspf=s"],
    ])("fails %s as weak", async (_label, record) => {
      expect(await dmarcOf("example.com", { "_dmarc.example.com": [record] })).toEqual({ status: "fail", finding: "weak", host: "_dmarc.example.com", record });
    });

    it("lets a stricter record than required pass", async () => {
      const record = "v=DMARC1; p=reject; adkim=s; aspf=s; rua=mailto:dmarc@example.com; pct=100";
      expect(await dmarcOf("example.com", { "_dmarc.example.com": [record] }, { expectDmarc: { policy: "quarantine" } })).toMatchObject({ status: "pass", finding: "found" });
    });

    it("reads the subdomain policy of an inherited record as the domain's policy", async () => {
      const loose = { "_dmarc.example.com": ["v=DMARC1; p=reject; sp=quarantine; adkim=s; aspf=s"] };
      expect(await dmarcOf("mail.example.com", loose, { expectDmarc: { policy: "reject" } })).toMatchObject({ status: "fail", finding: "weak", host: "_dmarc.example.com" });
      const strict = { "_dmarc.example.com": ["v=DMARC1; p=reject; adkim=s; aspf=s"] };
      expect(await dmarcOf("mail.example.com", strict, { expectDmarc: { policy: "reject" } })).toMatchObject({ status: "pass", finding: "inherited" });
    });

    it("keeps a weaker record that meets every requirement given", async () => {
      expect(await dmarcOf("example.com", { "_dmarc.example.com": ["v=DMARC1; p=quarantine; adkim=s"] }, { expectDmarc: { adkim: "s" } })).toMatchObject({ status: "pass", finding: "found" });
    });

    it("still reports a missing record as missing", async () => {
      expect(await dmarcOf("example.com", {})).toMatchObject({ status: "fail", finding: "missing" });
    });
  });

  describe("reply path", () => {
    const ROUTES: MxRecord[] = [
      { exchange: "route2.mx.example.net", priority: 86 },
      { exchange: "route1.mx.example.net", priority: 13 },
    ];
    const replyOf = async (replyTo: string, mx: Record<string, MxRecord[] | Error>, txt: Record<string, string[] | Error> = {}) =>
      (await checkSenderDns("mail.example.com", { replyTo, resolveTxt: zone(txt), resolveMx: mxZone(mx) })).replyTo;

    it("passes a reply domain with MX records, listed by priority", async () => {
      expect(await replyOf("Support <hello@Example.com>", { "example.com": ROUTES }, { "example.com": [SPF] })).toEqual({
        status: "pass",
        finding: "found",
        host: "example.com",
        record: "13 route1.mx.example.net, 86 route2.mx.example.net",
      });
    });

    it.each(["hello@example.com", "example.com"])("takes an address or a bare domain (%s)", async (replyTo) => {
      expect(await replyOf(replyTo, { "example.com": ROUTES })).toMatchObject({ status: "pass", host: "example.com" });
    });

    it("fails a domain without MX records: replies bounce", async () => {
      expect(await replyOf("hello@example.com", {})).toEqual({ status: "fail", finding: "missing", host: "example.com", record: null });
    });

    it.each(["", "."])("fails a null MX (exchange %j), which refuses all mail", async (exchange) => {
      expect(await replyOf("hello@example.com", { "example.com": [{ exchange, priority: 0 }] })).toEqual({ status: "fail", finding: "null-mx", host: "example.com", record: "0 ." });
    });

    it("fails two SPF records on the reply domain", async () => {
      expect(await replyOf("hello@example.com", { "example.com": ROUTES }, { "example.com": [SPF, "v=spf1 -all"] })).toEqual({ status: "fail", finding: "multiple", host: "example.com", record: null });
    });

    it("reports the missing MX before two SPF records", async () => {
      expect(await replyOf("hello@example.com", {}, { "example.com": [SPF, "v=spf1 -all"] })).toMatchObject({ finding: "missing" });
    });

    it.each([
      ["MX", { "example.com": dnsError("ESERVFAIL") }, {}],
      ["SPF", { "example.com": ROUTES }, { "example.com": dnsError("ETIMEOUT") }],
    ] as const)("reports a failed %s lookup", async (_label, mx, txt) => {
      expect(await replyOf("hello@example.com", mx, txt)).toEqual({ status: "fail", finding: "lookup-failed", host: "example.com", record: null });
    });
  });

  describe("return path", () => {
    const pathOf = async (returnPath: readonly ReturnPathHost[], cname: Record<string, string[] | Error>, mx: Record<string, MxRecord[] | Error> = {}) =>
      (await checkSenderDns("mail.example.com", { returnPath, resolveTxt: nothing, resolveCname: cnameZone(cname), resolveMx: mxZone(mx) })).returnPath;

    it("passes hosts that are CNAMEs, in the order given", async () => {
      expect(await pathOf([{ host: "send.mail.example.com" }, { host: "rsend.mail.example.com" }], { "send.mail.example.com": ["send.forge.rmta.net"], "rsend.mail.example.com": ["rsend-euw1.forge.rmta.net."] })).toEqual([
        { status: "pass", finding: "found", host: "send.mail.example.com", record: "send.forge.rmta.net" },
        { status: "pass", finding: "found", host: "rsend.mail.example.com", record: "rsend-euw1.forge.rmta.net" },
      ]);
    });

    it("checks the CNAME target against the expected domain", async () => {
      const returnPath = [{ host: "send.mail.example.com", targetDomain: "rmta.net" }];
      expect(await pathOf(returnPath, { "send.mail.example.com": ["send.forge.rmta.net."] })).toMatchObject([{ status: "pass" }]);
      expect(await pathOf(returnPath, { "send.mail.example.com": ["rmta.net"] })).toMatchObject([{ status: "pass" }]);
      for (const target of ["send.forge.rmta.net.evil.example", "send.forgermta.net", "evilrmta.net"]) {
        expect(await pathOf(returnPath, { "send.mail.example.com": [target] })).toEqual([{ status: "fail", finding: "unexpected-target", host: "send.mail.example.com", record: target }]);
      }
    });

    it("accepts MX records on a host without a CNAME (the older bounce setup)", async () => {
      expect(await pathOf([{ host: "send.mail.example.com" }], {}, { "send.mail.example.com": [{ exchange: "feedback-smtp.eu-west-1.amazonses.com", priority: 10 }] })).toEqual([
        { status: "pass", finding: "found", host: "send.mail.example.com", record: "10 feedback-smtp.eu-west-1.amazonses.com" },
      ]);
    });

    it("fails a host with neither", async () => {
      expect(await pathOf([{ host: "rsend.mail.example.com" }], {})).toEqual([{ status: "fail", finding: "missing", host: "rsend.mail.example.com", record: null }]);
    });

    it("reports a failed lookup", async () => {
      expect(await pathOf([{ host: "send.mail.example.com" }], { "send.mail.example.com": dnsError("ESERVFAIL") })).toEqual([{ status: "fail", finding: "lookup-failed", host: "send.mail.example.com", record: null }]);
    });

    it("gives Resend's two hosts with their target domain", () => {
      expect(resendReturnPath("Mail.Example.com.")).toEqual([
        { host: "send.mail.example.com", targetDomain: "rmta.net" },
        { host: "rsend.mail.example.com", targetDomain: "rmta.net" },
      ]);
    });
  });
});

describe("getSenderDomain", () => {
  it("reads a long run of angle brackets in linear time", () => {
    const started = performance.now();
    getSenderDomain(`<${"<=".repeat(100_000)}`);
    expect(performance.now() - started).toBeLessThan(1_000);
  });

  it.each([
    ["Plan <hello@Mail.Example.com>", "mail.example.com"],
    ["hello@example.com", "example.com"],
  ])("reads the domain of %s", (from, domain) => {
    expect(getSenderDomain(from)).toBe(domain);
  });
});
