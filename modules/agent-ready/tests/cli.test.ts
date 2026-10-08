// The `agent-ready` CLI with an injected fetch, output and terminal flag: every command and every exit code.
import { buildAgentSkillsIndex, createAgentSkill } from "@softure-ai/agent-ready";
import { buildSignatureDirectory, createWebBotAuthKey, getDirectorySignatureHeaders } from "@softure-ai/agent-ready/server";
import { describe, expect, it } from "vitest";
import { DOH_ENDPOINT, runAgentReadyCli, type RunAgentReadyCliOptions } from "../src/cli/run.js";

const RFC_SEED = "n4Ni-HpISpVObnQMW0wOhCKROaIKqKtW_2ZYb2p9KcU";

async function run(argv: string[], extra: Partial<RunAgentReadyCliOptions> = {}) {
  const out: string[] = [];
  const err: string[] = [];
  const code = await runAgentReadyCli({ argv, output: { out: (line) => out.push(line), err: (line) => err.push(line) }, ...extra });
  return { code, out, err };
}

function respond(routes: Record<string, () => Response>) {
  return (input: string) => {
    const handler = routes[input];
    return Promise.resolve(handler === undefined ? new Response("missing", { status: 404 }) : handler());
  };
}

describe("usage", () => {
  it("exits 2 with the usage for no command or an unknown one", async () => {
    expect((await run([])).code).toBe(2);
    const unknown = await run(["deploy"]);
    expect(unknown.code).toBe(2);
    expect(unknown.err[0]).toBe('agent-ready: unknown command "deploy"');
    expect(unknown.err[1]).toContain("Usage:");
  });
});

describe("web-bot-auth key", () => {
  it("prints the variable for the secret store and the public key on stderr", async () => {
    const result = await run(["web-bot-auth", "key"], { isTerminal: false, random: () => Buffer.from(RFC_SEED, "base64url") });
    expect(result.code).toBe(0);
    expect(result.out).toEqual([`WEB_BOT_AUTH_PRIVATE_KEY=${RFC_SEED}`]);
    expect(result.err).toEqual(["public key (x): JrQLj5P_89iXES9-vFgrIy29clF9CC_oPPsw3c5D0bs", "keyid (RFC 7638 thumbprint): poqkLGiymh_W0uP6PZFw-dvez3QJT5SolqXBCW38r0U"]);
  });

  it("refuses to print the secret to a terminal", async () => {
    const result = await run(["web-bot-auth", "key"], { isTerminal: true });
    expect(result.code).toBe(2);
    expect(result.out).toEqual([]);
  });
});

describe("dns-aid check", () => {
  const svcb = (data: string) => () => Response.json({ Status: 0, AD: true, Answer: [{ type: 64, data }] });
  const fetchAll = respond({
    [`${DOH_ENDPOINT}?name=_mcp._agents.example.com&type=64&do=1`]: svcb('1 app.example.com. alpn="h2" port=443'),
    [`${DOH_ENDPOINT}?name=example.com&type=43&do=1`]: () => Response.json({ Status: 0, AD: true, Answer: [{ type: 43, data: "1 13 2 ab" }] }),
  });

  it("exits 0 when every check passes", async () => {
    const result = await run(["dns-aid", "check", "--domain", "example.com", "--record", "_mcp=app.example.com"], { fetch: fetchAll });
    expect(result.code).toBe(0);
    expect(result.out.at(-1)).toBe("DNS-AID: all 6 checks pass");
  });

  it("exits 1 and prints the zone lines when a check fails", async () => {
    const result = await run(["dns-aid", "check", "--domain", "example.com", "--record", "_mcp=mcp.example.com"], { fetch: fetchAll });
    expect(result.code).toBe(1);
    expect(result.out).toContain('  _mcp._agents.example.com. 3600 IN SVCB 1 mcp.example.com. alpn="h2" port=443');
    expect(result.out.at(-1)).toBe("DNS-AID: 1 of 6 checks fail");
  });

  it("exits 1 when the resolver fails, and 2 for wrong arguments", async () => {
    expect((await run(["dns-aid", "check", "--domain", "example.com", "--record", "_mcp=app.example.com"], { fetch: () => Promise.resolve(new Response("", { status: 503 })) })).code).toBe(1);
    expect((await run(["dns-aid", "check", "--domain", "example.com"])).code).toBe(2);
    expect((await run(["dns-aid", "check", "--domain", "example.com", "--record", "mcp"])).code).toBe(2);
    expect((await run(["dns-aid", "check", "--bogus"])).code).toBe(2);
  });
});

describe("check", () => {
  const skill = createAgentSkill("notes", "Notes.", "\nBody\n");
  const key = createWebBotAuthKey(RFC_SEED);
  if (key === null) throw new Error("no key");
  const directory = () => new Response(JSON.stringify(buildSignatureDirectory(key)), { headers: getDirectorySignatureHeaders("example.com", { key }) });
  const routes = {
    "https://example.com/.well-known/agent-skills/index.json": () => Response.json(buildAgentSkillsIndex([skill])),
    "https://example.com/.well-known/agent-skills/notes/SKILL.md": () => new Response(skill.markdown),
  };

  it("exits 0 when the digests match and the directory is signed for the host", async () => {
    const result = await run(["check", "https://example.com/anything"], { fetch: respond({ ...routes, "https://example.com/.well-known/http-message-signatures-directory": directory }) });
    expect(result.code).toBe(0);
    expect(result.out).toEqual(["ok   skill notes: digest matches", `ok   signature directory: binding0: signed by ${key.keyid} for example.com`]);
  });

  it("skips a directory that answers 404 (no key configured)", async () => {
    const result = await run(["check", "https://example.com"], { fetch: respond(routes) });
    expect(result.code).toBe(0);
    expect(result.out[1]).toBe("ok   signature directory: 404, no key configured (skipped)");
  });

  it("exits 1 for a changed skill file or a directory signed for another host", async () => {
    const changed = await run(["check", "https://example.com"], { fetch: respond({ ...routes, "https://example.com/.well-known/agent-skills/notes/SKILL.md": () => new Response(`${skill.markdown}!`) }) });
    expect(changed.code).toBe(1);
    expect(changed.out[0]).toContain("FAIL skill notes: index sha256:");
    const wrongHost = () => new Response(JSON.stringify(buildSignatureDirectory(key)), { headers: getDirectorySignatureHeaders("other.example", { key }) });
    const signed = await run(["check", "https://example.com"], { fetch: respond({ ...routes, "https://example.com/.well-known/http-message-signatures-directory": wrongHost }) });
    expect(signed.code).toBe(1);
    expect(signed.out[1]).toBe("FAIL signature directory: binding0: the signature does not verify for example.com");
  });

  it("exits 2 without a URL", async () => {
    expect((await run(["check"])).code).toBe(2);
    expect((await run(["check", "ftp://example.com"])).code).toBe(2);
  });
});
