// Every pattern of the English ruleset trips on a sample, so a typo in a regex cannot switch a rule off.
import { enRuleset, findSignificantNumbers } from "@softure-ai/blog/server";
import { describe, expect, it } from "vitest";

const SAMPLES: Readonly<Record<string, string>> = {
  announcement: "It's worth noting that fees add up.",
  "these-days": "In today's fast-paced world, everyone saves.",
  "not-only-but-also": "The fund is not only cheap but also simple.",
  "not-x-but-y": "It's not a fund, it's a lifestyle.",
  "meta-commentary": "Let's dive into the numbers.",
  "throat-clearing": "Here's why fees matter.",
  "empty-conclusion": "In conclusion, fees matter.",
  crucial: "Fees are crucial.",
  "plays-a-role": "Age plays a key role.",
  puffery: "A groundbreaking fund.",
  "chatbot-phrases": "I hope this helps.",
  emoji: "Returns grow 🚀",
  "filler-words": "Moreover, fees add up.",
  exclamation: "Fees add up!",
};

const hits = (pattern: RegExp, text: string) => new RegExp(pattern.source, pattern.flags).test(text);

describe("the English ruleset", () => {
  it("has a sample for every pattern", () => {
    expect(Object.keys(SAMPLES).sort()).toEqual(enRuleset.patterns.map((pattern) => pattern.id).sort());
  });

  it.each(enRuleset.patterns.map((pattern) => [pattern.id, pattern] as const))("%s trips on its sample", (id, pattern) => {
    expect(hits(pattern.pattern, SAMPLES[id] ?? "")).toBe(true);
  });

  it("matches first person singular and profit promises, not their negations", () => {
    expect(hits(enRuleset.firstPersonSingular, "In my opinion it works.")).toBe(true);
    expect(hits(enRuleset.firstPersonSingular, "Minecraft is a game.")).toBe(false);
    expect(hits(enRuleset.profitPromises, "These are guaranteed returns.")).toBe(true);
    expect(hits(enRuleset.profitPromises, "Investing is not risk-free.")).toBe(false);
  });

  it("finds amounts, percentages and large numbers, not years, references or small counts", () => {
    const prose = "In 2026 the fee was 1% on $28,260.50 and 12,000 units, under section 401 and rule 5, for 3 people aged 60.";
    expect(findSignificantNumbers(prose, enRuleset.notation)).toEqual(["1", "28,260.50", "12,000"]);
  });
});
