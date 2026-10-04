// Every pattern of the Polish ruleset trips on a sample, so a typo in a regex cannot switch a rule off.
import { plRuleset } from "@softure-ai/blog/server";
import { describe, expect, it } from "vitest";

const SAMPLES: Readonly<Record<string, string>> = {
  announcement: "Warto zauważyć, że limit rośnie.",
  "these-days": "W dzisiejszych czasach każdy oszczędza.",
  "not-only-but-also": "Konto jest nie tylko tanie, ale także proste.",
  "not-x-but-y": "To nie jest konto, to styl życia.",
  "meta-commentary": "Przyjrzyjmy się limitom.",
  "throat-clearing": "Co ciekawe, limit rośnie.",
  "empty-conclusion": "Podsumowując, warto oszczędzać.",
  crucial: "To kluczowa decyzja.",
  "plays-a-role": "Wiek odgrywa ważną rolę.",
  puffery: "To kompleksowe rozwiązanie.",
  "chatbot-phrases": "Mam nadzieję, że to pomoże.",
  emoji: "Zysk rośnie 🚀",
  "filler-words": "Ponadto limit rośnie.",
  exclamation: "Limit rośnie!",
  "straight-quotes": 'Tak zwany "most".',
};

describe("the Polish ruleset", () => {
  it("has a sample for every pattern", () => {
    expect(Object.keys(SAMPLES).sort()).toEqual(plRuleset.patterns.map((pattern) => pattern.id).sort());
  });

  it.each(plRuleset.patterns.map((pattern) => [pattern.id, pattern] as const))("%s trips on its sample", (id, pattern) => {
    expect(new RegExp(pattern.pattern.source, pattern.pattern.flags).test(SAMPLES[id] ?? "")).toBe(true);
  });

  it("matches first person singular and profit promises, not their negations", () => {
    expect(plRuleset.firstPersonSingular.test("Moim zdaniem to dobry plan.")).toBe(true);
    expect(new RegExp(plRuleset.profitPromises.source, "giu").test("To gwarantowany zysk.")).toBe(true);
    expect(new RegExp(plRuleset.profitPromises.source, "giu").test("Inwestowanie nie jest bez ryzyka.")).toBe(false);
  });

  it("does not treat a word inside another word as a hit", () => {
    expect(new RegExp(plRuleset.firstPersonSingular.source, "giu").test("Jajko i mieszkanie.")).toBe(false);
  });
});
