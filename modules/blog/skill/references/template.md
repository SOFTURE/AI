# The file `{{contentDir}}/<slug>.md`

One file per text; the file name is the slug plus `.md`. The frontmatter keys are fixed and an
unknown key is an error (rule `file`). Copy a text of `{{contentDir}}` that passes the gate when
there is one; otherwise start from this:

```markdown
---
id: <stable-kebab-key>          # given once, never changed
slug: <kebab-file-name>         # the address under {{articlesPath}}/; equals the file name
kind: article                   # or: term (a glossary definition)
cluster: <topic>                # optional: the topic for "read next" lists
pillar: false                   # true only for the main text of the cluster
title: <the question or the number, up to {{titleChars}} characters>
description: <the answer with its number, {{descriptionCharsMin}} to {{descriptionCharsMax}} characters>
summary: <a few sentences with the answer and its numbers>
status: draft                   # draft | published | withdrawn
current_as_of: YYYY-MM-DD       # the day the facts were checked
sources:
  - name: <name of the act, dataset or document>
    url: https://<primary source>
faq:
  - question: <the question as a person asks it>
    answer: <one sentence with a number>
---

<Lead: the answer and its number[^source]. A second sentence with the worked example's number.>

<Context in one or two sentences.>

## <The question a person asks?>

<The answer in the first sentence, with a footnote on the number[^source].>

## <What does it mean for a concrete case?>

<Inputs, result, a small table, and one sentence that reads a number out of it.>

## <When does it not work?>

<The condition under which the answer turns around.>

[^source]: <Source name>: https://<the same address as in sources>
```
{{#fields}}

The app adds its own keys: {{fieldKeys}}. Look up their use in a published text of
`{{contentDir}}`.
{{/fields}}
{{#reservedSlugs}}

Slugs taken by the blog's own pages, never usable for a text: {{reservedSlugList}}.
{{/reservedSlugs}}

## A glossary term (`kind: term`)

The same folder and format, at `{{termsPath}}/<slug>`. The differences:

```markdown
---
id: <kebab-key>
slug: <kebab-key>
kind: term
title: <the name of the concept, as the glossary index lists it>
description: <the definition in one sentence, with a number>
forms:                          # required: the phrases that link to this term from articles
  - <phrase as it stands in texts>
  - <another inflected form>
status: draft
current_as_of: YYYY-MM-DD
sources:
  - name: <source>
    url: https://<primary source>
---

<The definition in the first sentence, with a number and its footnote[^source]. {{termWordsMin}} to
{{termWordsMax}} words in all, a lead of up to {{leadWordsTerm}}.>
```

- **Forms** are phrases, not single words: "bridge to retirement", not "bridge", or every sentence
  about a bridge gets a link. Each inflected form separately; a capital at the start of a sentence
  matches by itself.
- The renderer links the **first** mention of a form in the prose of an article (not in a heading,
  link, code or footnote); a manual link is needed only where no form matches.
- **Slug change:** change `slug` and rename the file, keep `id`; the old address redirects.
- **Withdrawal:** `status: withdrawn`; never delete the file.
