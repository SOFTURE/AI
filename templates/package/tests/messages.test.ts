import { describe, expect, it } from "vitest";
import { templateMessages } from "@softure-ai/template-module";

// Imported through the package name: the `@softure-ai/source` export condition resolves it to
// `src/` without a build (vitest.config.mts, tsconfig.base.json).
describe("template messages", () => {
  it("ships an English title and a Polish one that is translated, not copied", () => {
    expect(templateMessages.en.example.title).toBe("Example");
    expect(templateMessages.pl.example.title).not.toBe(templateMessages.en.example.title);
  });
});
