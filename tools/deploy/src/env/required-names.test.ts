import { describe, expect, it } from "vitest";
import { findComposeNames, findRequiredNames } from "./required-names.js";

describe("findRequiredNames", () => {
  it("finds both required forms, sorted, and says which accepts an empty value", () => {
    const compose = [
      "services:",
      "  app:",
      "    environment:",
      "      DATABASE_URL: ${DATABASE_URL:?set DATABASE_URL}",
      "      AUTH_SECRET: ${AUTH_SECRET:?}",
      "      SENTRY_DSN: ${SENTRY_DSN?may be empty}",
    ].join("\n");
    expect(findRequiredNames(compose)).toEqual([
      { name: "AUTH_SECRET", allowsEmpty: false },
      { name: "DATABASE_URL", allowsEmpty: false },
      { name: "SENTRY_DSN", allowsEmpty: true },
    ]);
  });

  it("ignores optional forms and escaped dollars", () => {
    const compose = "a: ${PLAIN}\nb: ${WITH_DEFAULT:-x}\nc: ${UNSET_DEFAULT-x}\nd: $${ESCAPED:?}\ne: $$${REAL:?}";
    expect(findRequiredNames(compose)).toEqual([{ name: "REAL", allowsEmpty: false }]);
  });

  it("lists a repeated name once, with the stricter form winning", () => {
    expect(findRequiredNames("a: ${TOKEN?}\nb: ${TOKEN:?}\nc: ${TOKEN?}")).toEqual([{ name: "TOKEN", allowsEmpty: false }]);
  });

  it("returns an empty list for a compose file without required names", () => {
    expect(findRequiredNames("")).toEqual([]);
    expect(findRequiredNames("services:\n  db:\n    image: postgres:16\n")).toEqual([]);
  });
});

describe("findComposeNames", () => {
  it("lists optional names with a default, apart from the required ones", () => {
    const compose = [
      "a: ${DATABASE_URL:?}",
      "b: ${MCP_ALLOW_WRITES:-}",
      "c: ${ADMIN_EMAILS-}",
      "d: ${REGISTRATION_CLOSED:-0}",
      "e: ghcr.io/acme/app:${TAG}",
    ].join("\n");
    expect(findComposeNames(compose)).toEqual({
      required: [{ name: "DATABASE_URL", allowsEmpty: false }],
      optional: ["ADMIN_EMAILS", "MCP_ALLOW_WRITES", "REGISTRATION_CLOSED"],
    });
  });

  it("treats a name required anywhere as required, whatever the order", () => {
    expect(findComposeNames("${A:-}\n${A:?x}")).toEqual({ required: [{ name: "A", allowsEmpty: false }], optional: [] });
    expect(findComposeNames("${A:?x}\n${A:-}")).toEqual({ required: [{ name: "A", allowsEmpty: false }], optional: [] });
  });

  it("lists a repeated optional name once and skips an escaped one", () => {
    expect(findComposeNames("${B:-1}\n${B-2}\n$${ESCAPED:-x}")).toEqual({ required: [], optional: ["B"] });
  });
});
