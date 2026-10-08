// Server-only logic: the IndexNow submit and the HTML to Markdown conversion. No `next/*` imports here (docs/02-module-standard.md §1),
// so a publish CLI can call it outside a request.
export {
  INDEXNOW_ENDPOINT,
  INDEXNOW_MAX_URLS,
  submitToIndexNow,
  type IndexNowFailure,
  type IndexNowRequestBody,
  type IndexNowResult,
  type SubmitToIndexNowOptions,
} from "./indexnow.js";
export { htmlToMarkdown, type HtmlToMarkdownOptions } from "./html-to-markdown.js";
