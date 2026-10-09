// The body input of the blog's pages lives in `src/server/body-options.ts`: it needs no request scope,
// so a renderer outside Next imports it from `/server`; `/next` exports the same functions.
export { findArticlesLinkingTermFor, getBodyOptions, type ArticlesLinkingTermInput } from "../server/body-options.js";
