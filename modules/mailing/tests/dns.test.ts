// The sender DNS check: SPF, DKIM and DMARC from TXT records.
import { checkSenderDns, getSenderDomain, type ResolveTxt } from "@softure-ai/mailing/server";
import { describe, expect, it } from "vitest";

const SPF = "v=spf1 include:amazonses.com ~all";
const DKIM = "p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC";
const DMARC = "v=DMARC1; p=quarantine; rua=mailto:dmarc@example.com";

function dnsError(code: string): Error {
  return Object.assign(new Error(`queryTxt ${code}`), { code });
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
    });
  });

  it("fails all three when nothing is published", async () => {
    expect(await checkSenderDns("example.com", { resolveTxt: zone({}) })).toEqual({
      domain: "example.com",
      spf: { status: "fail", finding: "missing", host: "example.com", record: null },
      dkim: { status: "fail", finding: "missing", host: "resend._domainkey.example.com", record: null },
      dmarc: { status: "fail", finding: "missing", host: "_dmarc.example.com", record: null },
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
