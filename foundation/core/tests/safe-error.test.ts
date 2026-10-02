import { describe, expect, it } from "vitest";
import { errorLogLabel, safeError } from "@softure-ai/core";

describe("safeError", () => {
  it("hides a Drizzle query failure behind core.database_failed", () => {
    const error = new Error('Failed query: select "email" from "users" where "id" = $1\nparams: 42');
    expect(safeError(error)).toEqual({ ok: false, error: "core.database_failed" });
  });

  it("hides a bare SQL statement behind core.database_failed", () => {
    const error = new Error('select "email" from "users" where "id" = 42');
    expect(safeError(error)).toEqual({ ok: false, error: "core.database_failed" });
  });

  it("reports any other error as core.unexpected", () => {
    expect(safeError(new Error("Please select a plan from the list"))).toEqual({ ok: false, error: "core.unexpected" });
  });

  it("accepts a thrown value that is not an Error", () => {
    expect(safeError("boom")).toEqual({ ok: false, error: "core.unexpected" });
    expect(safeError(undefined)).toEqual({ ok: false, error: "core.unexpected" });
  });
});

describe("errorLogLabel", () => {
  it("returns the class name of a plain error", () => {
    expect(errorLogLabel(new TypeError("secret@example.com"))).toBe("TypeError");
  });

  it("adds the SQLSTATE found on the error", () => {
    const error = Object.assign(new Error('duplicate key "secret@example.com"'), { code: "23505" });
    expect(errorLogLabel(error)).toBe("Error code=23505");
  });

  it("adds the SQLSTATE found on the cause", () => {
    const cause = Object.assign(new Error("driver"), { code: "22P02" });
    expect(errorLogLabel(new Error("Failed query: select 1", { cause }))).toBe("Error code=22P02");
  });

  it("ignores a code that is not a five-character SQLSTATE", () => {
    const error = Object.assign(new Error("x"), { code: "ECONNREFUSED 10.0.0.1" });
    expect(errorLogLabel(error)).toBe("Error");
  });

  it("returns the type of a value that is not an Error", () => {
    expect(errorLogLabel("secret@example.com")).toBe("string");
    expect(errorLogLabel(null)).toBe("object");
  });
});
