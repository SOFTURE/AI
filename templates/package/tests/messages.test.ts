import { describe, expect, it } from "vitest";
import { templateMessages } from "@softure-ai/template-module";

// Imported through the package name: the `@softure-ai/source` export condition resolves it to
// `src/` without a build (vitest.config.mts, tsconfig.base.json).
describe("template messages", () => {
  it("ships English as its only built-in dictionary", () => {
    expect(Object.keys(templateMessages)).toEqual(["en"]);
    expect(templateMessages.en.example.title).toBe("Example");
  });
});
