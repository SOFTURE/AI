import { describe, expect, it } from "vitest";
import { SECURITY_SCENARIOS, extractCoverage, getMissingScenarios, resolveCoverage, toRepositoryPath, type AgentCoverage } from "../src/coverage.js";
import { CATEGORY_RULES } from "../src/findings.js";
import { readReviewPrompt } from "../src/review.js";

function block(entry: Record<string, unknown>): string {
  return `<coverage>${JSON.stringify(entry)}</coverage>`;
}

describe("SECURITY_SCENARIOS", () => {
  it("names every security-focus rule as a scenario, plus secrets", () => {
    const focusRules = ["auth-session", "oauth-flow", "token-scope", "webhook-verification", "command-injection", "ssrf", "csrf", "rate-limit", "runtime-hardening"];
    for (const rule of focusRules) {
      expect(SECURITY_SCENARIOS as readonly string[]).toContain(rule);
      expect(CATEGORY_RULES.security as readonly string[]).toContain(rule);
    }
    expect(SECURITY_SCENARIOS).toHaveLength(10);
    expect(SECURITY_SCENARIOS).toContain("secrets");
  });
});

describe("extractCoverage", () => {
  it("reads valid blocks, normalizes their files and rejects the rest with a reason", () => {
    const text = [
      "Mapping the surface.",
      block({ scenario: "oauth-flow", status: "traced", files: ["./src/oauth.ts"], note: "Redirect URIs match exactly." }),
      "<coverage>{not json}</coverage>",
      block({ scenario: "dns", status: "traced", files: [], note: "x" }),
      block({ scenario: "csrf", status: "skipped", note: "x" }),
      block({ scenario: "ssrf", status: "no-surface", note: "No outbound fetch of input URLs (searched fetch, axios, http.request)." }),
    ].join("\n");
    const extracted = extractCoverage(text);
    expect(extracted.coverage).toEqual([
      { scenario: "oauth-flow", status: "traced", files: ["src/oauth.ts"], note: "Redirect URIs match exactly." },
      { scenario: "ssrf", status: "no-surface", files: [], note: "No outbound fetch of input URLs (searched fetch, axios, http.request)." },
    ]);
    expect(extracted.rejected).toEqual(["coverage not JSON: {not json}", "not a coverage entry (scenario)", "not a coverage entry (status)"]);
  });

  it("rejects a block without a note", () => {
    expect(extractCoverage(block({ scenario: "csrf", status: "no-surface" })).rejected).toEqual(["not a coverage entry (note)"]);
  });
});

describe("toRepositoryPath", () => {
  it("makes an absolute path inside the repository relative and refuses one outside", () => {
    expect(toRepositoryPath("/repo", "/repo/src/a.ts")).toBe("src/a.ts");
    expect(toRepositoryPath("/repo", "src/a.ts")).toBe("src/a.ts");
    expect(toRepositoryPath("/repo", "./src/a.ts")).toBe("src/a.ts");
    expect(toRepositoryPath("/repo", "/etc/passwd")).toBeNull();
    expect(toRepositoryPath("/repo", "/repo")).toBeNull();
  });
});

describe("resolveCoverage", () => {
  const read = new Set(["src/oauth.ts", "src/session.ts"]);

  it("gives one entry per scenario in the prompt's order and marks the unaccounted ones not covered", () => {
    const coverage = resolveCoverage([{ scenario: "oauth-flow", status: "traced", files: ["src/oauth.ts"], note: "Exact match." }], read);
    expect(coverage.map((entry) => entry.scenario)).toEqual([...SECURITY_SCENARIOS]);
    expect(coverage[1]).toEqual({ scenario: "oauth-flow", status: "traced", files: ["src/oauth.ts"], note: "Exact match." });
    expect(coverage[0]).toEqual({ scenario: "auth-session", status: "not-covered", files: [], note: "The run did not account for this scenario." });
    expect(getMissingScenarios(coverage)).toEqual(SECURITY_SCENARIOS.filter((scenario) => scenario !== "oauth-flow"));
  });

  it("keeps only files the run read, and a traced scenario with none left is not covered", () => {
    const blocks: AgentCoverage[] = [
      { scenario: "auth-session", status: "traced", files: ["src/session.ts", "src/never-read.ts", "src/session.ts"], note: "Rotated." },
      { scenario: "csrf", status: "traced", files: ["src/never-read.ts"], note: "Origin check." },
      { scenario: "ssrf", status: "no-surface", files: ["src/never-read.ts"], note: "No outbound requests." },
    ];
    const coverage = resolveCoverage(blocks, read);
    expect(coverage.find((entry) => entry.scenario === "auth-session")?.files).toEqual(["src/session.ts"]);
    expect(coverage.find((entry) => entry.scenario === "csrf")).toEqual({
      scenario: "csrf",
      status: "not-covered",
      files: [],
      note: "Claimed as traced, but named no file the run read. Origin check.",
    });
    expect(coverage.find((entry) => entry.scenario === "ssrf")).toEqual({ scenario: "ssrf", status: "no-surface", files: [], note: "No outbound requests." });
  });

  it("lets the agent's last block for a scenario win", () => {
    const coverage = resolveCoverage(
      [
        { scenario: "csrf", status: "no-surface", files: [], note: "First guess." },
        { scenario: "csrf", status: "traced", files: ["src/session.ts"], note: "Traced after all." },
      ],
      read,
    );
    expect(coverage.find((entry) => entry.scenario === "csrf")?.note).toBe("Traced after all.");
  });
});

describe("the security prompt's coverage step", () => {
  const prompt = readReviewPrompt("security");

  it("names every scenario, both statuses and the block format", () => {
    for (const scenario of SECURITY_SCENARIOS) expect(prompt, scenario).toContain(`\`${scenario}\``);
    expect(prompt).toContain("<coverage>{");
    expect(prompt).toContain("`traced`");
    expect(prompt).toContain("`no-surface`");
    expect(prompt).toContain("a file you did not read does not count");
  });

  it("covers runtime and deployment hardening", () => {
    for (const text of ["Runtime and deployment hardening", "non-root user", "cap_drop", "no-new-privileges", "compromised host"]) {
      expect(prompt, text).toContain(text);
    }
  });

  it("parses its own examples", () => {
    const extracted = extractCoverage(prompt);
    expect(extracted.rejected).toEqual([]);
    expect(extracted.coverage.map((entry) => entry.status)).toEqual(["traced", "no-surface"]);
  });
});
