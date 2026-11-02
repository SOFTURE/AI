// Tells a failure caused by the database being unavailable (a restart, a refused or closed connection) from any other.
import { isDatabaseUnavailableError } from "@softure-ai/jobs/server";
import { describe, expect, it } from "vitest";

function withCode(message: string, code: string): Error {
  return Object.assign(new Error(message), { code });
}

describe("isDatabaseUnavailableError", () => {
  it.each(["57P01", "57P02", "57P03", "08000", "08003", "08006", "08001", "08004"])("is true for SQLSTATE %s", (code) => {
    expect(isDatabaseUnavailableError(withCode("server error", code))).toBe(true);
  });

  it.each(["ECONNREFUSED", "ECONNRESET", "EPIPE", "ETIMEDOUT", "EHOSTUNREACH", "ENETUNREACH", "ENOTFOUND", "EAI_AGAIN"])(
    "is true for the socket code %s",
    (code) => {
      expect(isDatabaseUnavailableError(withCode("socket error", code))).toBe(true);
    },
  );

  it.each([
    "Connection terminated unexpectedly",
    "Connection terminated",
    "Connection terminated due to connection timeout",
    "Client has encountered a connection error and is not queryable",
    "timeout exceeded when trying to connect",
  ])("is true for the connection message %j without a code", (message) => {
    expect(isDatabaseUnavailableError(new Error(message))).toBe(true);
  });

  it("looks through the cause of a wrapped query error", () => {
    const wrapped = new Error('Failed query: select 1 from "jobs"."jobs"', { cause: withCode("terminating connection", "57P01") });
    expect(isDatabaseUnavailableError(wrapped)).toBe(true);
  });

  it("looks through the errors of an AggregateError", () => {
    const aggregate = new AggregateError([withCode("connect", "ECONNREFUSED"), withCode("connect", "ECONNREFUSED")], "");
    expect(isDatabaseUnavailableError(aggregate)).toBe(true);
  });

  it("stops on a cause cycle", () => {
    const first = new Error("first");
    const second = new Error("second", { cause: first });
    Object.assign(first, { cause: second });
    expect(isDatabaseUnavailableError(first)).toBe(false);
  });

  it.each([
    ["a unique violation", withCode("duplicate key", "23505")],
    ["a syntax error", withCode("syntax error", "42601")],
    ["a query cancelled by a statement timeout", withCode("canceling statement", "57014")],
    ["a plain error", new Error("boom")],
    ["a wrapped error with another cause", new Error("Failed query", { cause: withCode("deadlock", "40P01") })],
    ["a string", "Connection terminated"],
    ["undefined", undefined],
  ])("is false for %s", (_name, error) => {
    expect(isDatabaseUnavailableError(error)).toBe(false);
  });
});
