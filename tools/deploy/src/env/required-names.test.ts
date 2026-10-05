import { describe, expect, it } from "vitest";
import { findRequiredNames } from "./required-names.js";

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
