// The Polish ruleset (FIRE_TRACKER `src/lib/blog/quality/rules-style.ts`, `text.ts`). A translation and
// extension of `blader/humanizer` and `hardikpandya/stop-slop`. Errors are habits a careful author uses
// rarely and on purpose; warnings are words that say nothing alone but betray a template in a cluster.
// FIRE's voice (no first person singular) and finance phrases are app config, not Polish.
import { wordPattern } from "../../text.js";
import type { LanguageRuleset } from "../types.js";

const L = "\\p{L}*";

export const plRuleset: LanguageRuleset = {
  language: "pl",
  patterns: [
    {
      id: "announcement",
      severity: "error",
      pattern: wordPattern("(?:warto|należy) (?:zauważyć|podkreślić|wspomnieć|nadmienić|dodać|zaznaczyć)"),
      message: "an announcement instead of a fact; write the fact",
    },
    {
      id: "these-days",
      severity: "error",
      pattern: wordPattern(`w dzisiejszych czasach|w dzisiejszym (?:świecie|dynamicznym${L})|w dobie|w obecnych czasach`),
      message: "an empty opener about \"these times\"; start with a number or the answer",
    },
    {
      id: "not-only-but-also",
      severity: "error",
      pattern: wordPattern("nie tylko[^.!?]{1,120}?,? (?:ale|lecz) (?:także|również|też|i)"),
      message: "\"not only…, but also\"; name both things plainly",
    },
    {
      id: "not-x-but-y",
      severity: "error",
      pattern: wordPattern("(?:to nie (?:jest )?[^.!?,]{1,60}, (?:to|tylko|lecz)|nie chodzi o [^.!?]{1,80}[.,] (?:chodzi o|tylko o|lecz o))"),
      message: "the \"it is not X, it is Y\" contrast; say Y right away",
    },
    {
      id: "meta-commentary",
      severity: "error",
      pattern: wordPattern(
        "w (?:tym|niniejszym) (?:artykule|tekście|wpisie|poradniku)|przyjrzyjmy się|zanurzmy się|przejdźmy (?:teraz )?do|jak (?:już )?wspomniano|jak zaraz zobaczysz|jak zobaczymy|dowiesz się (?:z tego|w tym)",
      ),
      message: "the text talks about itself instead of the topic; remove the announcement",
    },
    {
      id: "throat-clearing",
      severity: "error",
      pattern: wordPattern(
        "prawda jest taka|oto (?:dlaczego|jak|co|czemu)|i tu pojawia się|co ciekawe|co ważne|co istotne|nie da się ukryć|nie ulega wątpliwości|bez wątpienia|niewątpliwie|bezsprzecznie",
      ),
      message: "a run-up before the point; cut it and start with the point",
    },
    {
      id: "empty-conclusion",
      severity: "error",
      pattern: wordPattern("podsumowując|reasumując|w podsumowaniu|na zakończenie|konkludując|krótko podsumowując"),
      message: "an empty conclusion; end with the last concrete fact",
    },
    {
      id: "crucial",
      severity: "error",
      pattern: wordPattern(`kluczow${L}`),
      message: "\"crucial\", the most common Polish tic of language models; name what depends on the thing",
    },
    {
      id: "plays-a-role",
      severity: "error",
      pattern: wordPattern(`odgryw${L} (?:\\p{L}+ )?rolę`),
      message: "\"plays a role\"; write what the thing does",
    },
    {
      id: "puffery",
      severity: "error",
      pattern: wordPattern(
        `kamień milowy|przełomow${L}|rewolucyjn${L}|game[- ]changer${L}|klucz do sukcesu|nieocenion${L}|holistyczn${L}|kompleksow${L}|szerok${L} (?:wachlarz${L}|gam${L}|spektrum)|w gąszczu|dynamicznie zmieniając${L}|nie ma jednej (?:dobrej |właściwej |uniwersalnej |prostej )?odpowiedzi|zależy od wielu czynników`,
      ),
      message: "an inflated or empty phrase; replace it with a fact",
    },
    {
      id: "chatbot-phrases",
      severity: "error",
      pattern: wordPattern("mam nadzieję, że|daj (?:mi )?znać|chętnie pomogę|świetne pytanie|jako model językowy|według mojej wiedzy|na dzień mojej wiedzy|w razie pytań"),
      message: "a leftover of a chat with an assistant; remove it",
    },
    {
      id: "emoji",
      severity: "error",
      pattern: /\p{Extended_Pictographic}/gu,
      message: "an emoji in the text; remove it",
    },
    {
      id: "filler-words",
      severity: "warning",
      pattern: wordPattern(
        `ponadto|dodatkowo|co więcej|istotn${L}|fundamentaln${L}|innymi słowy|krótko mówiąc|w rezultacie|niezwykle|niezmiernie|naprawdę|absolutnie|zdecydowanie|dosłownie|po prostu|optymaln${L}|efektywn${L}|pamiętaj, że|warto`,
      ),
      message: "a filler word; check whether the sentence says the same without it",
    },
    {
      id: "exclamation",
      severity: "warning",
      pattern: /!/g,
      message: "an exclamation mark; a guide speaks calmly",
    },
    {
      id: "straight-quotes",
      severity: "warning",
      pattern: /[“"]/g,
      message: "an English quotation mark; Polish uses „…”",
    },
  ],
  firstPersonSingular: wordPattern("ja|mnie|mój|moja|moje|mojego|mojej|moim|moich|moją|mi|uważam|sądzę|myślę|moim zdaniem|osobiście"),
  profitPromises: wordPattern(
    `gwarantowan${L} (?:zysk${L}|zwrot${L}|dochód${L}|zarobek${L})|pewn${L} zysk${L}|(?<!nie (?:jest|są|ma|będzie) )bez (?:żadnego )?ryzyka|zero ryzyka|nie (?:możesz|można) (?:nic )?stracić|na pewno zarobisz|zarobisz na pewno|kup(?:uj)? (?:teraz|już dziś)|musisz (?:kupić|zainwestować)|szybk${L} (?:zysk${L}|wzbogacen${L})|łatw${L} pieniądz${L}|bez wysiłku`,
  ),
  notation: {
    number: /\d{1,3}(?:[ \u00a0\u202f]\d{3})+(?:,\d+)?|\d+(?:,\d+)?/g,
    unitAfter: /^\s?(?:%|proc|zł|złotych|zl\b|PLN|tys|mln|mld|groszy|gr\b)/iu,
    unitBefore: null,
    referenceBefore: /(?:art\.|ust\.|poz\.|pkt|§|nr|Dz\.\s?U\.?|M\.P\.)\s*$/iu,
    thousandsSeparator: /[ \u00a0\u202f]/,
    decimalSeparator: ",",
  },
  triad: /(?<![\p{L}])\p{L}+, \p{L}+,? (?:i|oraz) \p{L}+(?![\p{L}])/gu,
  flagsTitleCaseHeadings: true,
};
