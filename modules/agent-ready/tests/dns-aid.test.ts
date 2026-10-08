// DNS-AID. The oracle is written by hand, not computed from the code: zone lines as a DNS provider takes them, and
// wire bytes laid out from RFC 9460 §2.2 and §7 (priority u16, the name in labels, key/length/value pairs; alpn = 1,
// port = 3).
import { evaluateDnsAid, formatZoneLine, parseSvcbData, resolveDnsAidRecords, type DohResponse, type ResolvedDnsAid } from "@softure-ai/agent-ready";
import { describe, expect, it } from "vitest";
import { APEX, APP, createOptions } from "./support.js";

const INDEX = "_index._agents.example.com";
const MCP = "_mcp._agents.example.com";
const RECORDS = resolveDnsAidRecords(createOptions(), { appOrigin: APP, apexOrigin: APEX });

/** `1 app.example.com. alpn=h2 port=443` in wire format, 32 bytes. */
const MCP_WIRE =
  "0001" +
  "03617070" + // 3 "app"
  "076578616d706c65" + // 7 "example"
  "03636f6d" + // 3 "com"
  "00" +
  "0001" + "0003" + "026832" + // alpn: [2 "h2"]
  "0003" + "0002" + "01bb"; // port: 443

const NXDOMAIN: DohResponse = { Status: 3, AD: false };
const RRSIG = { type: 46, data: "SVCB 13 4 3600 20261012000000 20261005000000 34505 example.com. abc=" };

const NOTHING: ResolvedDnsAid = { records: { [INDEX]: NXDOMAIN, [MCP]: NXDOMAIN }, ds: { Status: 0, AD: false } };

const TARGET: ResolvedDnsAid = {
  records: {
    [INDEX]: { Status: 0, AD: true, Answer: [{ type: 64, data: '1 example.com. alpn="h2" port=443' }, RRSIG] },
    [MCP]: { Status: 0, AD: true, Answer: [RRSIG, { type: 64, data: `\\# 32 ${MCP_WIRE}` }] },
  },
  ds: { Status: 0, AD: true, Answer: [{ type: 43, data: "2371 13 2 1f987cc6583e92df0890718c42" }] },
};

function failing(resolved: ResolvedDnsAid): string[] {
  return evaluateDnsAid(RECORDS, resolved)
    .filter((check) => !check.ok)
    .map((check) => check.check);
}

function withRecord(name: string, response: DohResponse): ResolvedDnsAid {
  return { ...TARGET, records: { ...TARGET.records, [name]: response } };
}

describe("the records", () => {
  it("point _index at the apex and _mcp at the app host, as zone lines a provider takes", () => {
    expect(RECORDS.map(formatZoneLine)).toEqual([
      '_index._agents.example.com. 3600 IN SVCB 1 example.com. alpn="h2" port=443',
      '_mcp._agents.example.com. 3600 IN SVCB 1 app.example.com. alpn="h2" port=443',
    ]);
  });

  it("take a configured domain and explicit hosts", () => {
    const options = createOptions({ dnsAid: { domain: "example.org", records: [{ label: "_a2a", target: "agents.example.org", purpose: "A2A" }] } });
    expect(resolveDnsAidRecords(options, { appOrigin: APP, apexOrigin: APEX })).toEqual([
      { name: "_a2a._agents.example.org", target: "agents.example.org", alpn: ["h2"], port: 443, purpose: "A2A" },
    ]);
  });
});

describe("parseSvcbData", () => {
  it("reads the presentation form with and without quotes", () => {
    expect(parseSvcbData('1 app.example.com. alpn="h2,h3" port=443')).toEqual({ priority: 1, target: "app.example.com.", alpn: ["h2", "h3"], port: 443 });
    expect(parseSvcbData("1 . alpn=h3,h2 ipv4hint=192.0.2.1")).toEqual({ priority: 1, target: "", alpn: ["h3", "h2"], port: null });
  });

  it("reads the generic form of RFC 3597, laid out by hand from RFC 9460", () => {
    expect(parseSvcbData(`\\# 32 ${MCP_WIRE}`)).toEqual({ priority: 1, target: "app.example.com", alpn: ["h2"], port: 443 });
  });

  it("refuses truncated wire data instead of guessing", () => {
    expect(parseSvcbData(`\\# 30 ${MCP_WIRE.slice(0, 60)}`)).toBeNull();
    expect(parseSvcbData(`\\# 33 ${MCP_WIRE}`)).toBeNull();
    expect(parseSvcbData("nonsense")).toBeNull();
  });
});

describe("evaluateDnsAid", () => {
  it("fails all eleven checks when nothing is published", () => {
    const checks = evaluateDnsAid(RECORDS, NOTHING);
    expect(checks).toHaveLength(11);
    expect(checks.every((check) => !check.ok)).toBe(true);
    expect(checks.find((check) => check.check === "_index record")?.detail).toBe("the name does not exist (NXDOMAIN)");
  });

  it("passes all eleven for the target state; an RRSIG next to the record does not matter", () => {
    expect(failing(TARGET)).toEqual([]);
  });

  it("accepts an HTTPS record instead of SVCB, as scanners do", () => {
    expect(failing(withRecord(INDEX, { Status: 0, AD: true, Answer: [{ type: 65, data: '1 example.com. alpn="h3,h2" port=443' }] }))).toEqual([]);
  });

  it("fails AliasMode (priority 0)", () => {
    expect(failing(withRecord(INDEX, { Status: 0, AD: true, Answer: [{ type: 64, data: "0 example.com." }] }))).toEqual(["_index ServiceMode", "_index alpn+port"]);
  });

  it("fails a vendor host instead of the canonical one", () => {
    expect(failing(withRecord(MCP, { Status: 0, AD: true, Answer: [{ type: 64, data: '1 example.pages.dev. alpn="h2" port=443' }] }))).toEqual(["_mcp target"]);
  });

  it("fails a record without port or h2", () => {
    expect(failing(withRecord(MCP, { Status: 0, AD: true, Answer: [{ type: 64, data: '1 app.example.com. alpn="h3"' }] }))).toEqual(["_mcp alpn+port"]);
  });

  it("fails correct records without DNSSEC", () => {
    const unsigned: ResolvedDnsAid = {
      records: { [INDEX]: { ...TARGET.records[INDEX], Status: 0, AD: false }, [MCP]: { ...TARGET.records[MCP], Status: 0, AD: false } },
      ds: { Status: 0, AD: false },
    };
    expect(failing(unsigned)).toEqual(["_index DNSSEC", "_mcp DNSSEC", "DS at the registrar"]);
  });

  it("names a wrong DS after SERVFAIL, not a missing record", () => {
    const present = evaluateDnsAid(RECORDS, withRecord(INDEX, { Status: 2 })).find((check) => check.check === "_index record");
    expect(present?.ok).toBe(false);
    expect(present?.detail).toContain("SERVFAIL");
  });
});
