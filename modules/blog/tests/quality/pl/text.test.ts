// Blocks, prose, sentences and significant numbers in Polish texts (FIRE `src/lib/blog/quality/parse.test.ts`;
// the frontmatter cases are BL-2's parser's).
import { findSignificantNumbers, plRuleset, splitArticleBody, splitBlocks, splitSentences, toProse } from "@softure-ai/blog/server";
import { describe, expect, it } from "vitest";

describe("splitBlocks", () => {
  it("classifies blocks with file line numbers and skips code and comments", () => {
    const body = [
      "Akapit pierwszy",
      "ciąg dalszy.",
      "",
      "## Pytanie?",
      "",
      "- pozycja",
      "  kontynuacja",
      "",
      "| a | b |",
      "| - | - |",
      "",
      "```",
      "kluczowy kod",
      "```",
      "<!-- komentarz",
      "kluczowy -->",
      "> cytat",
      '::wykres{typ="most"}',
      "[^x]: https://example.org",
    ].join("\n");
    expect(splitBlocks(body, 10)).toEqual([
      { kind: "paragraph", text: "Akapit pierwszy ciąg dalszy.", line: 10 },
      { kind: "heading", text: "Pytanie?", line: 13, level: 2 },
      { kind: "listItem", text: "pozycja kontynuacja", line: 15 },
      { kind: "table", text: "| a | b |\n| - | - |", line: 18 },
      { kind: "quote", text: "cytat", line: 26 },
      { kind: "directive", text: '::wykres{typ="most"}', line: 27 },
      { kind: "footnote", text: "https://example.org", line: 28, footnoteId: "x" },
    ]);
  });

  it("finds the body's first line after the frontmatter, with a BOM and CRLF", () => {
    expect(splitArticleBody("﻿---\r\nid: a\r\n---\r\nTreść.")).toEqual({ body: "Treść.", bodyStartLine: 4 });
    expect(splitArticleBody("Bez frontmattera.")).toBeNull();
  });
});

describe("findSignificantNumbers", () => {
  it.each([
    ["Limit to 28 260 zł.", ["28 260"]],
    ["Zwrot 5% rocznie i 4,5 proc. w obligacjach.", ["5", "4,5"]],
    ["Ma 934 tys. zł i 1,2 mln zł.", ["934", "1,2"]],
    ["Dom za 650000.", ["650000"]],
    ["W 2026 roku, w wieku 60 lat, po 3 latach.", []],
    ["Art. 27 ust. 1, poz. 1202, Dz.U. 2026.", []],
    ["Konto IKE2 i PIT-37.", []],
  ])("%s", (text, expected) => {
    expect(findSignificantNumbers(text, plRuleset.notation)).toEqual(expected);
  });
});

describe("splitSentences and toProse", () => {
  it("does not split on abbreviations followed by a number", () => {
    expect(splitSentences("Zgodnie z art. 27 ust. 1 płacisz ok. 300 zł. Potem koniec.")).toEqual(["Zgodnie z art. 27 ust. 1 płacisz ok. 300 zł.", "Potem koniec."]);
  });

  it("drops link targets, footnotes, code and emphasis markers", () => {
    expect(toProse("Zobacz [kalkulator](/kalkulator?x=1)[^a], `kod` i **ważne** _słowo_ https://x.pl/a")).toBe("Zobacz kalkulator, i ważne słowo");
  });
});
