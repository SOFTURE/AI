# The rules of the gate

These are the rules `{{command}} check` enforces in this app, with the severity the app gave them.
An **error** stops the publish at one hit. A warning is reported once per text with a count: fix it
unless you have a reason. The gate reads {{languageName}} texts; its message names what it found.

The principle behind the style rules: a model writes for the widest possible reader, so it writes
in generalities. A person writes for one reader about one matter, concretely and unevenly. Every
sentence that stays adds something the reader did not have yet. When a sentence trips a rule,
rewrite the paragraph around its one thought; do not swap a word for a synonym.

## File and structure

| Rule | Severity | What the gate looks for | What to write instead |
| --- | --- | --- | --- |
| `file` | | | Fix the frontmatter as the message says; the template is in [template.md](template.md). |
| `title-length` | | | A title up to {{titleChars}} characters, with the question or the number. |
| `description-length` | | | A description of {{descriptionCharsMin}} to {{descriptionCharsMax}} characters that holds the answer. |
| `as-of-future` | | | `current_as_of` is the day you checked the facts, never a later one. |
| `stale` | | | Check every number against its source, then move `current_as_of` (older than {{staleAfterDays}} days warns). |
| `summary-missing` | | | Add `summary`: a few sentences with the answer and its number, quotable on their own. |
| `lead` | | | Open with a paragraph that answers the title's question, not with a heading, a list or a quote. |
| `lead-length` | | | Keep the first paragraph to {{leadWordsArticle}} words in an article, {{leadWordsTerm}} in a term. |
| `lead-number` | | | Put a concrete number, with its footnote, in the first two paragraphs. |
| `heading-h1` | | | No `#` heading in the body: the page takes its title from `title`. |
| `heading-order` | | | Go `##` then `###`; never skip a level. |
| `sections` | | | At least two `##` sections in an article. |
| `section-question` | | | Phrase at least one `##` heading as the question a reader asks an assistant. |
| `section-answer` | | | Under a question heading, a paragraph whose first sentence answers it. |
| `section-answer-length` | | | Keep the answer paragraph to {{answerWords}} words. |
| `length` | | | An article of {{articleWordsMin}} to {{articleWordsMax}} words, a term of {{termWordsMin}} to {{termWordsMax}}. |
| `footnote-undefined` | | | Define every `[^id]` at the end of the file. |
| `footnote-unused` | | | Remove a footnote definition nothing refers to, or refer to it. |
| `block-requires` | | | A block of the app's block plugins (a fence or a `::directive`) needs its frontmatter keys; add them. |
| `block-directive` | | | A `::directive` line names a directive the blog renders and writes its attributes as `key="value"` pairs, each key once. |

## Links

| Rule | Severity | What the gate looks for | What to write instead |
| --- | --- | --- | --- |
| `internal-links` | | | At least {{internalLinksArticle}} internal links in an article ({{internalLinksTerm}} in a term): related texts under `{{articlesPath}}/`, glossary terms under `{{termsPath}}/`, the app's pages. |
| `internal-link-target` | | | Link only to pages, texts and terms that exist (a draft does not count as a target). |
| `external-link-https` | | | Use the `https://` address of the source. |
| `external-link-dead` | | | Replace a link that does not answer with the source's current address (checked only with `--external`). |
| `term-form-conflict` | | | Give each phrase to one term: remove a form from every other term's `forms`, or link the other term by hand where it is meant. |

## Images

| Rule | Severity | What the gate looks for | What to write instead |
| --- | --- | --- | --- |
| `image-source` | | | Use an image from the site's own paths or an allowed host; without an image policy the app shows no images, so leave them out. |
| `image-alt` | | | Give every image an alt text that says what it shows (`![Monthly costs by category](/images/costs.png)`). |
| `image-dimensions` | | | Use only images the app knows the size of; ask for a new one to be added rather than linking a file. |

## Style

| Rule | Severity | What the gate looks for | What to write instead |
| --- | --- | --- | --- |
| `announcement` | | | State the fact itself: not "it is worth noting that the limit grows", but "the limit grows". |
| `these-days` | | | Start with the number or the answer, not with "these times". |
| `not-only-but-also` | | | Name both things plainly: "cheap and simple". |
| `not-x-but-y` | | | Say Y right away; the contrast with X nobody claimed is a template. |
| `meta-commentary` | | | Remove "in this article", "let us look at", "as mentioned": the text moves forward by itself. |
| `throat-clearing` | | | Cut the run-up ("the truth is", "interestingly") and keep the claim. |
| `empty-conclusion` | | | End with the last concrete fact, without "in summary" and a repeat. |
| `crucial` | | | Name what depends on the thing instead of calling it crucial. |
| `plays-a-role` | | | Write what the thing does. |
| `puffery` | | | Replace the inflated phrase ("comprehensive", "game changer", "it depends on many factors") with a fact or a conditional answer with a number. |
| `chatbot-phrases` | | | Remove leftovers of a chat ("I hope this helps", "great question"). |
| `emoji` | | | Remove it. |
| `filler-words` | | | Check whether the sentence says the same without the word; usually it does. |
| `exclamation` | | | Say it calmly, with a full stop. |
| `straight-quotes` | | | Use the language's own quotation marks. |
| `title-case-heading` | | | Capitalize only the first word of a heading (and proper names). |
| `dashes` | | | At most one dash per {{wordsPerDash}} words: use a full stop, a comma, a colon or brackets. |
| `dashes-paragraph` | | | At most one dash per paragraph. |
| `bold-density` | | | Bold at most one phrase per {{wordsPerBold}} words; let the sentence carry the weight. |
| `bold-labels` | | | Write prose, not lists of "**Label:** text" items. |
| `triads` | | | Enumerate two things, or four; lists of three in a row read as a template. |
| `long-sentences` | | | Split sentences longer than {{sentenceWords}} words. |
| `monotone-rhythm` | | | Mix short and long sentences. |
| `repeated-openings` | | | Do not start three sentences in a row with the same word. |

## Voice

| Rule | Severity | What the gate looks for | What to write instead |
| --- | --- | --- | --- |
| `first-person-singular` | | | Write "we" (the editors) and "you" (the reader), never "I". |
{{#ymyl}}

## YMYL: sources and claims

| Rule | Severity | What the gate looks for | What to write instead |
| --- | --- | --- | --- |
| `sources-missing` | | | List every source in `sources` (name and address). |
| `source-https` | | | Give every source its `https://` address. |
| `number-source` | | | Put a footnote on every paragraph, list item or table with an amount, a percentage or a number from 1000 up. |
| `footnote-source` | | | Give every footnote a source address{{#ownCalculationMark}} or the phrase "{{ownCalculationMark}}" with its inputs{{/ownCalculationMark}}. |
| `footnote-not-in-sources` | | | Add every address a footnote cites to `sources`. |
| `profit-promise` | | | Describe the risk and the condition; never promise a gain or tell the reader to buy. |
{{/ymyl}}
{{#plugins}}

## Plugins

| Rule | Severity | What the gate looks for | What to write instead |
| --- | --- | --- | --- |
| `plugin-failed` | | | A plugin of the app crashed on the text: report it to the developers, do not work around it. |
| `plugin-rule-undeclared` | | | A plugin reported a rule it does not declare: report it to the developers. |
{{/plugins}}

## The app's own rules

{{appRules}}

## What the gate cannot catch: check it yourself and ask the reviewer

- A one-sentence moral after every paragraph, golden lines written to be quoted.
- An argument with nobody ("many people think…"), borrowed authority ("experts say").
- Explaining the obvious to a reader who came for the number.
- Vague links ("is related to") instead of naming the relation.
- Participle tails (", highlighting the importance of…", ", which shows…").
- Avoiding "is" and "has": "serves as", "constitutes", "offers".
