export const en = {
  kinds: {
    article: "Article",
    term: "Glossary term",
  },
  statuses: {
    draft: "Draft",
    published: "Published",
    withdrawn: "Withdrawn",
  },
  render: {
    footnotesHeading: "Notes",
    /** `{number}`: the footnote number. */
    footnoteLabel: "Footnote {number}",
    backToText: "Back to text",
    opensInNewTab: "(opens in a new tab)",
    tableOfContents: "Contents",
  },
  pages: {
    blogTitle: "Blog",
    blogDescription: "Articles that explain the topic step by step, with sources and the day the facts were checked.",
    /** A page title with the brand: `{title}` the page, `{brand}` the site. */
    titleWithBrand: "{title} | {brand}",
    empty: "The first texts are on their way.",
    otherCluster: "Other texts",
    startHere: "Start here",
    /** `{minutes}`: whole minutes, at least 1 ("min" does not inflect, so no plural forms). */
    readingTime: "{minutes} min read",
    /** `{date}`: the day of the last change, on a card. */
    updatedOn: "Updated {date}",
    breadcrumbs: "Breadcrumbs",
    published: "Published",
    updated: "Updated",
    currentAsOf: "Current as of",
    readingTimeLabel: "Reading time",
    contents: "In this text",
    summary: "In short",
    faq: "Questions and answers",
    sources: "Sources",
    /** `{brand}`: the site's name; shown only when the app sets a brand. */
    signature: "{brand} editorial team",
    methodLink: "How our texts are made",
    disclaimerLabel: "Disclaimer",
    glossaryLink: "Glossary",
    glossaryTeaser: "short definitions of the terms the texts use.",
    readNext: "Read next",
  },
  glossary: {
    title: "Glossary",
    /** A glossary term's page title with the brand: `{title}` the term, `{brand}` the site. */
    termTitleWithBrand: "{title} | {brand}",
    description: "Short definitions of the terms the texts use, each with the day it was checked and its sources.",
    empty: "The first definitions are on their way.",
    explainedIn: "Explained in these texts",
    allTerms: "All terms",
  },
  method: {
    title: "How our texts are made",
    description: "Who writes the texts, where the facts come from and what is checked before a text is published.",
    whoTitle: "Who writes",
    whoBody: "The editorial team chooses every topic and signs every text with the site's name.",
    factsTitle: "Where the facts come from",
    factsBody: "Every number comes from a source listed under the text or from a calculation the text shows. Each text says on which day its facts were checked.",
    sourcesTitle: "Sources",
    sourcesBody: "We cite laws, official statistics and primary documents first, and link every source so you can check it yourself.",
    checksTitle: "Checks before publishing",
    checksBody: "Before a text goes live, automatic checks look at its structure, its links and its sources. A text that fails them is not published.",
    correctionsTitle: "Corrections",
    correctionsBody: "When a fact changes, we update the text and its date. A text that can no longer be corrected is withdrawn.",
  },
  gone: {
    title: "Text withdrawn",
    heading: "This text has been withdrawn",
    body: "We took it down because it was no longer current or correct.",
    link: "See the other texts on the blog",
  },
  feed: {
    /** The plain-text body of a 503 when the texts cannot be read. */
    unavailable: "The feed is unavailable for a moment. Try again in a few minutes.",
  },
  og: {
    alt: "An article from the blog",
  },
};
