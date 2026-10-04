// The English ruleset: the same habits as the Polish one, in English, after `blader/humanizer` and
// `hardikpandya/stop-slop`. Errors are habits a careful author uses rarely and on purpose; warnings
// are words that say nothing alone but betray a template in a cluster.
import { wordPattern } from "../../text.js";
import type { LanguageRuleset } from "../types.js";

export const enRuleset: LanguageRuleset = {
  language: "en",
  patterns: [
    {
      id: "announcement",
      severity: "error",
      pattern: wordPattern("it(?:'s| is) (?:worth|important to) (?:noting|note|mentioning|mention|pointing out|highlighting|emphasizing)|it should be noted|needless to say"),
      message: "an announcement instead of a fact; write the fact",
    },
    {
      id: "these-days",
      severity: "error",
      pattern: wordPattern("in today's (?:fast-paced |ever-changing |digital |modern )?(?:world|age|era|landscape)|in this day and age|in the modern era|now more than ever"),
      message: "an empty opener about \"these times\"; start with a number or the answer",
    },
    {
      id: "not-only-but-also",
      severity: "error",
      pattern: wordPattern("not only[^.!?]{1,120}? but also"),
      message: "\"not only…, but also\"; name both things plainly",
    },
    {
      id: "not-x-but-y",
      severity: "error",
      pattern: wordPattern("it(?:'s| is) not (?:just |only |about )?[^.!?,;]{1,60}[,;] it(?:'s| is)|this isn't (?:just )?[^.!?,;]{1,60}[,;] it's"),
      message: "the \"it is not X, it is Y\" contrast; say Y right away",
    },
    {
      id: "meta-commentary",
      severity: "error",
      pattern: wordPattern(
        "in this (?:article|post|guide|piece|blog post)|let's (?:dive|delve|take a (?:closer )?look|explore|break (?:it|this) down)|without further ado|as (?:we )?(?:mentioned|discussed) (?:earlier|above|before)|as you'll see|you'll learn|read on to",
      ),
      message: "the text talks about itself instead of the topic; remove the announcement",
    },
    {
      id: "throat-clearing",
      severity: "error",
      pattern: wordPattern(
        "the truth is|here's (?:why|how|what|the thing)|here's where|interestingly|importantly|undoubtedly|without a doubt|it goes without saying|make no mistake|the reality is",
      ),
      message: "a run-up before the point; cut it and start with the point",
    },
    {
      id: "empty-conclusion",
      severity: "error",
      pattern: wordPattern("in conclusion|to sum up|to summarize|in summary|all in all|at the end of the day|the bottom line is"),
      message: "an empty conclusion; end with the last concrete fact",
    },
    {
      id: "crucial",
      severity: "error",
      pattern: wordPattern("crucial|pivotal|delve|delves|delving|tapestry|testament to"),
      message: "a favourite word of language models; name what depends on the thing",
    },
    {
      id: "plays-a-role",
      severity: "error",
      pattern: wordPattern("plays? an? (?:\\p{L}+ )?role|playing an? (?:\\p{L}+ )?role"),
      message: "\"plays a role\"; write what the thing does",
    },
    {
      id: "puffery",
      severity: "error",
      pattern: wordPattern(
        "game[- ]changer|groundbreaking|revolutionary|cutting-edge|unparalleled|invaluable|holistic|comprehensive guide|ultimate guide|a wide (?:range|array|variety) of|navigat(?:e|ing) the (?:complex |ever-changing )?(?:world|landscape|maze) of|ever-evolving|ever-changing landscape|seamless(?:ly)?|there(?:'s| is) no one-size-fits-all|depends on many factors",
      ),
      message: "an inflated or empty phrase; replace it with a fact",
    },
    {
      id: "chatbot-phrases",
      severity: "error",
      pattern: wordPattern("I hope this helps|let me know if|feel free to|great question|as an AI(?: language model)?|as of my (?:last|knowledge) (?:update|cutoff)|happy to help|I'd be happy to"),
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
        "moreover|furthermore|additionally|in addition|in other words|simply put|very|really|truly|absolutely|definitely|literally|basically|essentially|actually|just|optimal|leverage|robust|remember that",
      ),
      message: "a filler word; check whether the sentence says the same without it",
    },
    {
      id: "exclamation",
      severity: "warning",
      pattern: /!/g,
      message: "an exclamation mark; a guide speaks calmly",
    },
  ],
  firstPersonSingular: wordPattern("I|I'm|I've|I'd|I'll|me|my|mine|myself|in my (?:opinion|view|experience)|personally"),
  profitPromises: wordPattern(
    "guaranteed (?:returns?|profits?|income|gains?)|(?:a )?sure (?:profit|bet|thing)|(?<!not |never |isn't |aren't )risk[- ]free|zero risk|no risk|(?:you )?can(?:'t|not) lose|you will (?:definitely |surely )?(?:profit|earn|get rich)|buy (?:now|today)|you (?:must|need to|have to) (?:buy|invest)|get rich quick|quick (?:profits?|riches)|easy money|effortless (?:income|returns?|wealth)",
  ),
  notation: {
    number: /\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?/g,
    unitAfter: /^\s?(?:%|percent\b|per cent\b|USD\b|EUR\b|GBP\b|dollars?\b|euros?\b|pounds?\b|k\b|thousand\b|million\b|billion\b|bn\b)/iu,
    unitBefore: /(?:[$€£]|USD ?|EUR ?|GBP ?)$/u,
    referenceBefore: /(?:§|section|sec\.|art\.|article|no\.|chapter|clause|rule|part)\s*$/iu,
    thousandsSeparator: /,/,
    decimalSeparator: ".",
  },
  triad: /(?<![\p{L}])\p{L}+, \p{L}+,? (?:and|or) \p{L}+(?![\p{L}])/gu,
  flagsTitleCaseHeadings: false,
};
