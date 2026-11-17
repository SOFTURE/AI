import { existsSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ReviewAgentOptions } from "../src/agent.js";
import { getBranchSuffix, getReportBranch, runCommand, type CommandContext } from "../src/cli/command.js";
import { CATEGORY_RULES } from "../src/findings.js";
import { parseReport, renderReport } from "../src/report.js";
import { readReviewPrompt, runReview, type QueryFunction } from "../src/review.js";
import { getScopeSlug, listWorkspaceFolders, parsePaths, resolveScope } from "../src/scope.js";
import { SOURCE, makeAgentFinding, makeRepo, toBlock } from "./fixtures.js";

let repo: { root: string; cleanup: () => void };

const ROOT_MANIFEST = JSON.stringify({ name: "acme", private: true, workspaces: ["modules/*", "tools/*"] });

beforeEach(() => {
  repo = makeRepo({
    "package.json": ROOT_MANIFEST,
    "AGENTS.md": "# Root rules\n",
    "modules/AGENTS.md": "Modules rules marker\n",
    "modules/auth/package.json": JSON.stringify({ name: "@acme/auth", exports: { ".": "./src/index.ts" } }),
    "modules/auth/README.md": "Auth readme marker\n",
    "modules/auth/CHANGELOG.md": "Auth changelog marker\n",
    "modules/auth/src/session.ts": SOURCE,
    "modules/auth/src/oauth.ts": SOURCE,
    "modules/auth/tests/session.test.ts": SOURCE,
    "modules/billing/package.json": JSON.stringify({ name: "@acme/billing" }),
    "modules/billing/src/pay.ts": SOURCE,
    "tools/cli/package.json": JSON.stringify({ name: "@acme/cli" }),
    "docs/guide/intro.md": SOURCE,
  });
});

afterEach(() => {
  repo.cleanup();
});

interface Call {
  prompt: string;
  options: ReviewAgentOptions;
}

function fakeQuery(findingBlocks: string[]): { query: QueryFunction; calls: Call[] } {
  const calls: Call[] = [];
  return {
    calls,
    query: (params) => {
      calls.push(params);
      return (async function* () {
        await Promise.resolve();
        yield { type: "assistant", message: { content: [{ type: "text", text: findingBlocks.join("\n") }] } };
        yield { type: "result", subtype: "success", is_error: false, total_cost_usd: 1.5, modelUsage: {} };
      })();
    },
  };
}

const NOW = new Date("2026-11-16T10:00:00Z");
const ENV = { ANTHROPIC_API_KEY: "k" };

const SESSION_FINDING = toBlock(makeAgentFinding({ file: "modules/auth/src/session.ts", symbol: "signIn" }));
const OAUTH_FINDING = toBlock(
  makeAgentFinding({ rule: "oauth-flow", severity: "warning", file: "modules/auth/src/oauth.ts", line: 4, symbol: "authorize" }),
);
const BILLING_FINDING = toBlock(makeAgentFinding({ file: "modules/billing/src/pay.ts", symbol: "pay" }));

describe("the security prompt", () => {
  const prompt = readReviewPrompt("security");

  it("walks through every threat scenario of the issue", () => {
    for (const scenario of [
      "Sign-in and sessions",
      "Session fixation",
      "Cookie flags",
      "Password reset",
      "user enumeration",
      "Account takeover by email change",
      "OAuth 2.1",
      "Redirect URI matching",
      "PKCE",
      "single use",
      "audience",
      "Consent is protected against CSRF",
      "Token revocation",
      "Dynamic client registration",
      "MCP and API tokens",
      "Write tools are gated",
      "another account",
      "Inbound webhooks",
      "raw body",
      "constant-time compare",
      "replay window",
      "idempotent",
      "Command execution and SSH",
      "argument injection",
      "sudo",
      "host keys",
      "audit record is written before the effect",
      "timeouts and output limits",
      "Outbound requests",
      "DNS rebinding",
      "Secrets and data",
      "telemetry",
    ]) {
      expect(prompt, scenario).toContain(scenario);
    }
  });

  it("names every security rule, the new ones included, and asks for the attack path", () => {
    for (const rule of CATEGORY_RULES.security) expect(prompt, rule).toContain(`\`${rule}\``);
    for (const rule of ["auth-session", "oauth-flow", "token-scope", "webhook-verification", "command-injection", "ssrf", "csrf", "rate-limit"]) {
      expect(CATEGORY_RULES.security, rule).toContain(rule);
    }
    expect(prompt).toContain("attack path");
    expect(prompt).toContain("<finding>{");
  });

  it("is a separate file: the general prompt stays the one of 0.1", () => {
    const general = readReviewPrompt();
    expect(general).toBe(readFileSync(new URL("../prompt/quality-review.md", import.meta.url), "utf8"));
    expect(general).toBe(readReviewPrompt("general"));
    expect(general).not.toBe(prompt);
    expect(general.startsWith("You are a senior reviewer doing a read-only quality review of one whole repository.")).toBe(true);
  });
});

describe("a general whole-repository run", () => {
  it("passes the 0.1 prompt and task word for word and writes a report without the new rows", async () => {
    const run = fakeQuery([BILLING_FINDING]);
    const outcome = await runReview({ repo: repo.root, commit: "abc123", now: NOW, query: run.query, env: ENV });
    expect(outcome.ok).toBe(true);
    expect(run.calls[0]?.options.systemPrompt).toBe(readReviewPrompt());
    expect(run.calls[0]?.prompt).toBe(
      [
        "Review the whole repository in your working directory, at commit abc123, as the instructions describe.",
        "Do not read QUALITY-REPORT.md or any earlier quality report: this run starts from scratch.",
        "The repository has no accepted exceptions.",
        "Emit every verified finding as a <finding> block as soon as you have verified it, then end with a one-line summary.",
      ].join("\n\n"),
    );
    const markdown = readFileSync(join(repo.root, "QUALITY-REPORT.md"), "utf8");
    expect(markdown.startsWith("# Quality report\n\n<!-- softure-quality-review format 1 -->\n\nA read-only review of the whole repository at one commit")).toBe(true);
    expect(markdown).not.toMatch(/\| (Focus|Scope|Paths) \|/);
  });
});

describe("resolveScope", () => {
  it("lists the workspace folders and resolves a package name to its folder", () => {
    expect(listWorkspaceFolders(repo.root)).toEqual(["modules/auth", "modules/billing", "tools/cli"]);
    expect(resolveScope(repo.root, "@acme/auth")).toEqual({ ok: true, scope: { folder: "modules/auth", packageName: "@acme/auth" } });
  });

  it("takes a folder, naming its package when it is a workspace package", () => {
    expect(resolveScope(repo.root, "modules/billing/")).toEqual({ ok: true, scope: { folder: "modules/billing", packageName: "@acme/billing" } });
    expect(resolveScope(repo.root, "./docs/guide")).toEqual({ ok: true, scope: { folder: "docs/guide", packageName: null } });
  });

  it("refuses an unknown package, a missing folder, a file, the root and anything outside the repository", () => {
    const errors = ["@acme/nope", "modules/nope", "docs/guide/intro.md", ".", "../", "/etc"].map((value) => {
      const result = resolveScope(repo.root, value);
      return result.ok ? "ok" : result.error;
    });
    expect(errors).toEqual([
      "The scope @acme/nope is neither a folder nor a workspace package of this repository",
      "The scope modules/nope is neither a folder nor a workspace package of this repository",
      "The scope docs/guide/intro.md is a file, not a folder",
      "The scope . is outside the repository (or is its root: leave the scope out for that)",
      "The scope ../ is outside the repository (or is its root: leave the scope out for that)",
      "The scope /etc must be a folder relative to the repository root",
    ]);
  });

  it("refuses a symlink that leads outside the repository", () => {
    symlinkSync(tmpdir(), join(repo.root, "outside"));
    expect(resolveScope(repo.root, "outside")).toEqual({
      ok: false,
      error: "The scope outside is outside the repository (or is its root: leave the scope out for that)",
    });
  });

  it("says a package name cannot resolve in a repository without workspaces", () => {
    const plain = makeRepo({ "package.json": JSON.stringify({ name: "app" }) });
    try {
      expect(resolveScope(plain.root, "@acme/auth")).toEqual({
        ok: false,
        error: "The scope @acme/auth is not a folder, and the repository has no workspaces to resolve a package name through",
      });
    } finally {
      plain.cleanup();
    }
  });
});

describe("a scoped run", () => {
  it("reports only inside the scope, leads the task with its context and writes the report in the scope", async () => {
    const run = fakeQuery([SESSION_FINDING, OAUTH_FINDING, BILLING_FINDING]);
    const outcome = await runReview({ repo: repo.root, commit: "abc123", now: NOW, query: run.query, env: ENV, scope: "@acme/auth" });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const task = run.calls[0]?.prompt ?? "";
    expect(task).toContain("Review `modules/auth` (the workspace package @acme/auth) in your working directory, at commit abc123");
    expect(task).toContain("report findings only for files inside modules/auth/");
    expect(task).toContain('<file path="modules/AGENTS.md">\nModules rules marker\n\n</file>');
    expect(task).toContain('<file path="modules/auth/README.md">\nAuth readme marker\n\n</file>');
    expect(task).toContain("Auth changelog marker");
    expect(task).toContain('"name":"@acme/auth"');
    expect(task).toContain("Its tests: modules/auth/tests/.");
    expect(task).toContain("Do not read modules/auth/QUALITY-REPORT.md");
    expect(task).not.toContain("# Root rules");
    expect(outcome.path).toBe(join(repo.root, "modules/auth/QUALITY-REPORT.md"));
    expect(existsSync(join(repo.root, "QUALITY-REPORT.md"))).toBe(false);
    expect(outcome.report.findings.map((finding) => finding.file)).toEqual(["modules/auth/src/session.ts", "modules/auth/src/oauth.ts"]);
    expect(outcome.notes.some((note) => note.includes("modules/billing/src/pay.ts:3: outside the scope modules/auth"))).toBe(true);
    const parsed = parseReport(readFileSync(outcome.path, "utf8"));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.report.header.scope).toEqual({ folder: "modules/auth", packageName: "@acme/auth" });
    expect(readFileSync(outcome.path, "utf8")).toContain("| Scope | `modules/auth` (@acme/auth) |");
  });

  it("gives a finding the same id as a whole-repository run", async () => {
    const scoped = await runReview({ repo: repo.root, commit: "a", query: fakeQuery([SESSION_FINDING]).query, env: ENV, scope: "modules/auth" });
    const whole = await runReview({ repo: repo.root, commit: "a", query: fakeQuery([SESSION_FINDING]).query, env: ENV });
    expect(scoped.ok && whole.ok).toBe(true);
    if (!scoped.ok || !whole.ok) return;
    expect(scoped.report.findings[0]?.id).toBe(whole.report.findings[0]?.id);
  });

  it("applies the scope's own ignore file, with its globs relative to the scope", async () => {
    makeRepoFile("modules/auth/quality-review.ignore", "rule oauth-flow src/**   # accepted for this package\n");
    const outcome = await runReview({
      repo: repo.root,
      commit: "a",
      query: fakeQuery([SESSION_FINDING, OAUTH_FINDING]).query,
      env: ENV,
      scope: "modules/auth",
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.report.findings.map((finding) => finding.symbol)).toEqual(["signIn"]);
    expect(outcome.report.header.ignored).toBe(1);
  });

  it("fails before any model call when the scope does not resolve, and leaves the old report alone", async () => {
    makeRepoFile("QUALITY-REPORT.md", "old");
    const run = fakeQuery([]);
    const outcome = await runReview({ repo: repo.root, commit: "a", query: run.query, env: ENV, scope: "@acme/nope" });
    expect(outcome).toEqual({ ok: false, error: "The scope @acme/nope is neither a folder nor a workspace package of this repository", costUsd: 0 });
    expect(run.calls).toEqual([]);
    expect(readFileSync(join(repo.root, "QUALITY-REPORT.md"), "utf8")).toBe("old");
  });
});

describe("paths", () => {
  it("drops findings outside the globs, also within a scope, and lists them in the header", async () => {
    const run = fakeQuery([SESSION_FINDING, OAUTH_FINDING, BILLING_FINDING]);
    const outcome = await runReview({ repo: repo.root, commit: "a", query: run.query, env: ENV, paths: ["modules/**/oauth.ts", "modules/billing/**"] });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.report.findings.map((finding) => finding.symbol)).toEqual(["authorize", "pay"]);
    expect(run.calls[0]?.prompt).toContain("Report findings only for files that match one of these globs (relative to the repository root): modules/**/oauth.ts, modules/billing/**.");
    expect(readFileSync(outcome.path, "utf8")).toContain("| Paths | `modules/**/oauth.ts`, `modules/billing/**` |");

    const scoped = await runReview({ repo: repo.root, commit: "a", query: fakeQuery([SESSION_FINDING, OAUTH_FINDING, BILLING_FINDING]).query, env: ENV, scope: "modules/auth", paths: ["modules/billing/**", "**/oauth.ts"] });
    expect(scoped.ok && scoped.report.findings.map((finding) => finding.symbol)).toEqual(["authorize"]);
  });

  it("refuses a glob that leaves the repository", async () => {
    const run = fakeQuery([]);
    const outcome = await runReview({ repo: repo.root, commit: "a", query: run.query, env: ENV, paths: ["../secrets/**"] });
    expect(outcome.ok).toBe(false);
    expect(run.calls).toEqual([]);
  });

  it("splits repeated, comma and space separated values", () => {
    expect(parsePaths(["a/**, b/*.ts", "./c/** a/**", ""])).toEqual(["a/**", "b/*.ts", "c/**"]);
  });
});

describe("a security run", () => {
  it("runs the security prompt and writes a security report that check accepts", async () => {
    const run = fakeQuery([OAUTH_FINDING]);
    const outcome = await runReview({ repo: repo.root, commit: "abc123", now: NOW, query: run.query, env: ENV, focus: "security", scope: "@acme/auth", out: "modules/auth/SECURITY-REPORT.md" });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(run.calls[0]?.options.systemPrompt).toBe(readReviewPrompt("security"));
    expect(run.calls[0]?.options.tools).toEqual(["Read", "Glob", "Grep"]);
    const markdown = readFileSync(join(repo.root, "modules/auth/SECURITY-REPORT.md"), "utf8");
    expect(markdown.startsWith("# Security report\n")).toBe(true);
    expect(markdown).toContain("A read-only security review of `modules/auth` (@acme/auth) at one commit");
    expect(markdown).toContain("| Focus | security |");
    const parsed = parseReport(markdown);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.report.header.focus).toBe("security");
    expect(parsed.report.findings[0]?.rule).toBe("oauth-flow");
    expect(renderReport(parsed.report)).toBe(markdown);
  });

  it("refuses an unknown Focus or a malformed Scope in a report", () => {
    const run = renderReport({
      header: {
        date: "2026-11-16T10:00:00Z",
        commit: "a",
        model: "m",
        costUsd: 1,
        budgetUsd: 10,
        tokens: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        status: "complete",
        ignored: 0,
        focus: "security",
        scope: { folder: "modules/auth", packageName: null },
      },
      findings: [],
    });
    expect(parseReport(run).ok).toBe(true);
    const broken = run.replace("| Focus | security |", "| Focus | privacy |").replace("| Scope | `modules/auth` |", "| Scope | modules/auth |");
    expect(parseReport(broken)).toEqual({
      ok: false,
      errors: ['header: unknown Focus "privacy"', 'header: Scope is not "`<folder>`" or "`<folder>` (<package>)"'],
    });
  });
});

describe("softure-quality-review resolve and run with focus and scope", () => {
  let out = "";
  let err = "";

  function makeContext(query?: QueryFunction): CommandContext {
    return {
      cwd: repo.root,
      env: ENV,
      write: (text) => {
        out += text;
      },
      writeError: (text) => {
        err += text;
      },
      loadQuery: () => (query === undefined ? Promise.reject(new Error("no SDK in tests")) : Promise.resolve(query)),
    };
  }

  beforeEach(() => {
    out = "";
    err = "";
  });

  it("prints the report path, the branch suffix, the report branch, the scope folder and the focus", async () => {
    expect(await runCommand(["resolve", "--focus", "security", "--scope", "@acme/auth"], makeContext())).toBe(0);
    expect(out).toBe(
      "report-path=modules/auth/QUALITY-REPORT.md\nbranch-suffix=security/modules-auth\n" +
        "report-branch=quality-review-security--modules-auth\nscope-folder=modules/auth\nfocus=security\n",
    );
    out = "";
    expect(await runCommand(["resolve", "--focus", "", "--scope", "", "--out", ""], makeContext())).toBe(0);
    expect(out).toBe("report-path=QUALITY-REPORT.md\nbranch-suffix=\nreport-branch=quality-review-general\nscope-folder=\nfocus=general\n");
  });

  it("refuses an unknown focus or scope before it loads the SDK", async () => {
    expect(await runCommand(["resolve", "--focus", "privacy"], makeContext())).toBe(2);
    expect(await runCommand(["run", "--scope", "@acme/nope"], makeContext())).toBe(2);
    expect(await runCommand(["run", "--focus", "privacy"], makeContext())).toBe(2);
    expect(err).toBe(
      [
        '--focus must be one of general, security, not "privacy"',
        "The scope @acme/nope is neither a folder nor a workspace package of this repository",
        '--focus must be one of general, security, not "privacy"',
        "",
      ].join("\n"),
    );
  });

  it("runs a scoped security review with comma-separated paths", async () => {
    const run = fakeQuery([SESSION_FINDING, OAUTH_FINDING]);
    const code = await runCommand(
      ["run", "--commit", "a", "--focus", "security", "--scope", "modules/auth", "--paths", "modules/auth/src/oauth.ts, modules/auth/src/x/**"],
      makeContext(run.query),
    );
    expect(code).toBe(0);
    expect(out).toContain(`Report written to ${join(repo.root, "modules/auth/QUALITY-REPORT.md")}: 1 findings`);
    expect(run.calls[0]?.options.systemPrompt).toBe(readReviewPrompt("security"));
  });
});

describe("branch names", () => {
  it("joins the focus and the scope slug", () => {
    expect(getScopeSlug({ folder: "modules/mcp-access", packageName: null })).toBe("modules-mcp-access");
    expect(getScopeSlug({ folder: "_x/.y_", packageName: null })).toBe("x-y");
    expect(getScopeSlug({ folder: `a${"/".repeat(50_000)}`, packageName: null })).toBe("a");
    expect(getBranchSuffix("general", null)).toBe("");
    expect(getBranchSuffix("security", null)).toBe("security");
    expect(getBranchSuffix("general", { folder: "themes/theme_notion", packageName: "@x/y" })).toBe("themes-theme-notion");
  });

  it("names one flat report branch per focus and scope (issue #1324)", () => {
    const scope = { folder: "src/integrations", packageName: null };
    expect(getReportBranch("general", null)).toBe("quality-review-general");
    expect(getReportBranch("security", null)).toBe("quality-review-security");
    expect(getReportBranch("general", scope)).toBe("quality-review-general--src-integrations");
    expect(getReportBranch("security", scope)).toBe("quality-review-security--src-integrations");
  });

  it("gives branches git can hold side by side, also next to the 0.2.0 ones", () => {
    const folders = ["src/integrations", "docker", "src/app", "security", "general"];
    const names = (["general", "security"] as const).flatMap((focus) => [
      getReportBranch(focus, null),
      ...folders.map((folder) => getReportBranch(focus, { folder, packageName: null })),
    ]);
    const legacy = ["quality-review", "quality-review/security", "quality-review/security/src-integrations", "quality-review/docker"];
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) {
      expect(name).not.toContain("/");
      for (const other of [...names, ...legacy]) {
        if (other !== name) expect(other.startsWith(`${name}/`) || name.startsWith(`${other}/`)).toBe(false);
      }
    }
  });
});

function makeRepoFile(path: string, text: string): void {
  mkdirSync(dirname(join(repo.root, path)), { recursive: true });
  writeFileSync(join(repo.root, path), text);
}
