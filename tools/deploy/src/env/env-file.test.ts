import { describe, expect, it } from "vitest";
import { renderEnvFile } from "./env-file.js";

const strict = (name: string) => ({ name, allowsEmpty: false });

describe("renderEnvFile", () => {
  it("writes one line per name in the given order", () => {
    const result = renderEnvFile({
      names: [strict("A_URL"), strict("B_KEY")],
      env: { A_URL: "postgres://app:pw@db:5432/app", B_KEY: "abc-123_x.y", OTHER: "not written" },
    });
    expect(result).toEqual({
      ok: true,
      text: "A_URL=postgres://app:pw@db:5432/app\nB_KEY=abc-123_x.y\n",
      names: ["A_URL", "B_KEY"],
    });
  });

  it("single-quotes a value compose would otherwise interpolate or cut at a comment", () => {
    const result = renderEnvFile({ names: [strict("PASSWORD")], env: { PASSWORD: 'p$a ss #"x' } });
    expect(result).toEqual({ ok: true, text: `PASSWORD='p$a ss #"x'\n`, names: ["PASSWORD"] });
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
      text: "OPTIONAL_DSN=\nSECRET=s\n",
      names: ["OPTIONAL_DSN", "SECRET"],
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

  it("writes an empty file for an empty name list", () => {
    expect(renderEnvFile({ names: [], env: {} })).toEqual({ ok: true, text: "", names: [] });
  });
});
