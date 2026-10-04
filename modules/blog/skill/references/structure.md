# Structure for readers and for AI citations

AI assistants quote a fragment, not a whole text, and most quotes come from the first third of a
text. Numbers and quotes with a source raise the chance of being cited. Hence the order:

1. **Lead (one or two paragraphs, up to {{leadWordsArticle}} words):** the answer to the title's
   question and one concrete number with its footnote (rule `lead-number`). No warm-up about "these
   times" and no announcement of what follows.
2. **Context in one or two sentences:** where the number comes from.
3. **`##` sections as questions** people ask assistants. The first sentence under a question is a
   self-contained answer that can be cut out and quoted (rule `section-answer`), up to
   {{answerWords}} words.
4. **A worked example** for a concrete person or case: inputs, result, a small table (two to six
   rows) and one sentence that reads one number out of it. This is what generic summaries lack.
5. **When it does not work:** the condition under which the answer turns around. It separates a
   guide from an advert and is what comparisons quote.
6. **A checklist or steps** only when the reader really does something; do not turn prose into a
   list of "**Label:** text" items.

Length: an article of {{articleWordsMin}} to {{articleWordsMax}} words, a glossary term of
{{termWordsMin}} to {{termWordsMax}} words with a lead of up to {{leadWordsTerm}}.

## Footnotes

- `[^id]` right after the sentence with the number; definitions at the end of the file.
{{#ymyl}}
- A source: `[^limit]: <source name>: https://…`, and the same address stands in `sources` in the
  frontmatter (rule `footnote-not-in-sources`).
{{#ownCalculationMark}}
- Your own calculation: `[^calc]: {{ownCalculationMark}}: <inputs>, as of YYYY-MM-DD.` Write the inputs
  so that anyone can repeat the calculation and get the same result.
{{/ownCalculationMark}}
- Every amount, percentage and number from 1000 up carries a footnote (rule `number-source`).
  Years, ages, small counts and legal references need none.
{{/ymyl}}
{{^ymyl}}
- Footnote numbers a reader might doubt, with the source's address.
{{/ymyl}}

## Metadata

- `title` up to {{titleChars}} characters, with the question or the number; `description`
  {{descriptionCharsMin}} to {{descriptionCharsMax}} characters, with the answer.
- `summary`: the "in short" box above the body, a few sentences with numbers an assistant can quote.
- `current_as_of`: the day the facts were checked against their sources. Change it only after
  checking every number, never for a typo fix.
- `faq`: two to five `question`/`answer` pairs, each answer one sentence with a number.
- `cluster`: the topic, for "read next" lists. `pillar: true` only for the main text of a cluster
  (one per cluster); the others link to it.
{{#fields}}
- The app's own keys: {{fieldKeys}}. Their meaning is the app's; follow the examples in
  `{{contentDir}}`.
{{/fields}}

## Links

- Internal, at least {{internalLinksArticle}}: one or two texts of the same cluster
  (`{{articlesPath}}/<slug>`), a glossary term at the first use of a concept
  (`{{termsPath}}/<slug>`; the renderer links the first mention of a term's forms by itself, so link
  by hand only where no form matches), and the app's pages.
- External: primary sources only (laws, official statistics, the issuer's own documents). No
  competitors' blogs and no comparison sites.

## Disclaimers

A disclaimer such as "this is not investment advice" belongs to the page template, not the text.
{{#ymyl}}
The text guards the other side: no promise of a gain and no order to buy (rule `profit-promise`).
{{/ymyl}}
