import { describe, expect, it } from "vitest";
import { ENV_FILE_HEADER, renderEnvFile } from "./env-file.js";

const strict = (name: string) => ({ name, allowsEmpty: false });
const file = (...lines: string[]) => [ENV_FILE_HEADER, ...lines].map((line) => `${line}\n`).join("");

describe("renderEnvFile", () => {
  it("writes the header, then one line per name in the given order", () => {
    const result = renderEnvFile({
      names: [strict("A_URL"), strict("B_KEY")],
      env: { A_URL: "postgres://app:pw@db:5432/app", B_KEY: "abc-123_x.y", OTHER: "not written" },
    });
    expect(result).toEqual({
      ok: true,
      text: file("A_URL=postgres://app:pw@db:5432/app", "B_KEY=abc-123_x.y"),
      names: ["A_URL", "B_KEY"],
      optional: [],
    });
  });

  it("single-quotes a value compose would otherwise interpolate or cut at a comment", () => {
    const result = renderEnvFile({ names: [strict("PASSWORD")], env: { PASSWORD: 'p$a ss #"x' } });
    expect(result).toEqual({ ok: true, text: file(`PASSWORD='p$a ss #"x'`), names: ["PASSWORD"], optional: [] });
  });

  it("writes an empty value only where the compose file accepts it", () => {
    const names = [{ name: "OPTIONAL_DSN", allowsEmpty: true }, strict("SECRET")];
    expect(renderEnvFile({ names, env: { OPTIONAL_DSN: "", SECRET: "" } })).toEqual({
      ok: false,
      missing: ["SECRET"],
      unsafe: [],
    });
    expect(renderEnvFile({ names, env: { OPTIONAL_DSN: "", SECRET: "s" } })).toEqual({
      ok: true,
      text: file("OPTIONAL_DSN=", "SECRET=s"),
      names: ["OPTIONAL_DSN", "SECRET"],
      optional: [],
    });
  });

  it("refuses every missing name at once", () => {
    const names = [strict("A"), strict("B"), strict("C")];
    expect(renderEnvFile({ names, env: { B: "set" } })).toEqual({ ok: false, missing: ["A", "C"], unsafe: [] });
  });

  it("refuses a value with no literal one-line form and names only the variable", () => {
    const result = renderEnvFile({
      names: [strict("MULTILINE"), strict("QUOTE"), strict("FINE")],
      env: { MULTILINE: "line1\nline2", QUOTE: "it's", FINE: "ok" },
    });
    expect(result).toEqual({ ok: false, missing: [], unsafe: ["MULTILINE", "QUOTE"] });
    expect(JSON.stringify(result)).not.toContain("line1");
  });

  it("writes only the header for an empty name list", () => {
    expect(renderEnvFile({ names: [], env: {} })).toEqual({ ok: true, text: file(), names: [], optional: [] });
  });
});

describe("renderEnvFile with optional names", () => {
  it("writes an optional name the environment sets, after the required ones", () => {
    const result = renderEnvFile({
      names: [strict("DATABASE_URL")],
      optional: ["ADMIN_EMAILS", "MCP_ALLOW_WRITES"],
      env: { DATABASE_URL: "postgres://db/app", ADMIN_EMAILS: "owner@example.com,second@example.com", MCP_ALLOW_WRITES: "1" },
    });
    expect(result).toEqual({
      ok: true,
      text: file("DATABASE_URL=postgres://db/app", "ADMIN_EMAILS=owner@example.com,second@example.com", "MCP_ALLOW_WRITES=1"),
      names: ["DATABASE_URL", "ADMIN_EMAILS", "MCP_ALLOW_WRITES"],
      optional: ["ADMIN_EMAILS", "MCP_ALLOW_WRITES"],
    });
  });

  it("leaves out an optional name that is unset or empty, with no empty line and no problem", () => {
    const result = renderEnvFile({ names: [strict("A")], optional: ["UNSET", "EMPTY"], env: { A: "a", EMPTY: "" } });
    expect(result).toEqual({ ok: true, text: file("A=a"), names: ["A"], optional: [] });
  });

  it("refuses an optional value with no literal one-line form, by name", () => {
    const result = renderEnvFile({ names: [], optional: ["SWITCH"], env: { SWITCH: "it's on" } });
    expect(result).toEqual({ ok: false, missing: [], unsafe: ["SWITCH"] });
  });
});
