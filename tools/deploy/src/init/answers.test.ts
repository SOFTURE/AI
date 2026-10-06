import { describe, expect, it } from "vitest";
import { parseInitAnswers, toAppName } from "./answers.js";

const VALID = {
  domain: "example.com",
  image: "ghcr.io/acme/app",
  name: "app",
  paths: ["/"],
  www: false,
  env: [],
  tables: [],
};

describe("parseInitAnswers", () => {
  it("accepts the minimal answers", () => {
    expect(parseInitAnswers(VALID)).toEqual({ ok: true, answers: VALID });
  });

  it("accepts every optional answer", () => {
    const answers = { ...VALID, paths: ["/blog", "/api/public/"], www: true, acmeEmail: "ops@example.com", env: ["AUTH_SECRET"], tables: ["users", "billing.subscriptions"] };
    expect(parseInitAnswers(answers)).toEqual({ ok: true, answers });
  });

  it("refuses values that would break out of YAML, bash or a Traefik rule, one line per field", () => {
    const result = parseInitAnswers({
      ...VALID,
      domain: "Example.com`) || Host(`evil.com",
      image: "ghcr.io/acme/app:latest",
      name: "App Name",
      paths: ["/blog`)"],
      acmeEmail: "a@b",
      env: ["auth_secret"],
      tables: ["users; drop"],
    });
    expect(result).toEqual({
      ok: false,
      problems: [
        "domain: a lower-case host name such as example.com",
        "image: registry/name in lower case without a tag, such as ghcr.io/acme/app",
        "name: lower case letters, digits and -, starting with a letter, at most 40",
        "paths.0: / or a path prefix such as /blog",
        "acmeEmail: an e-mail address",
        "env.0: an upper snake case name",
        "tables: not a table name (table or schema.table, lower snake case): users; drop",
      ],
    });
  });

  it("refuses / next to other prefixes and an empty list", () => {
    expect(parseInitAnswers({ ...VALID, paths: ["/", "/blog"] })).toEqual({
      ok: false,
      problems: ["paths: / already allows every path; list it alone"],
    });
    expect(parseInitAnswers({ ...VALID, paths: [] })).toMatchObject({ ok: false });
  });

  it("refuses env names the runner or the templates own", () => {
    expect(parseInitAnswers({ ...VALID, env: ["NODE_OPTIONS", "DATABASE_URL"] })).toEqual({
      ok: false,
      problems: ["env.0: reserved for the runner (PATH, HOME, NODE_*, NPM_CONFIG_*)", "env.1: already set by the templates"],
    });
  });

  it("refuses an unknown answer", () => {
    expect(parseInitAnswers({ ...VALID, port: 8080 })).toEqual({ ok: false, problems: ['answers: Unrecognized key: "port"'] });
  });
});

describe("toAppName", () => {
  it("drops the scope and keeps a slug", () => {
    expect(toAppName("@acme/Web_App")).toBe("web-app");
    expect(toAppName("softure-example-next-app")).toBe("softure-example-next-app");
  });

  it("starts with a letter and stays within 40 characters", () => {
    expect(toAppName("123-app")).toBe("app");
    expect(toAppName(`a${"-b".repeat(30)}`)).toBe("a-b-b-b-b-b-b-b-b-b-b-b-b-b-b-b-b-b-b-b");
  });

  it("falls back to app when nothing usable is left", () => {
    expect(toAppName(undefined)).toBe("app");
    expect(toAppName("@acme/123")).toBe("app");
  });
});
