// Source guards of @softure-ai/testing (`@softure-ai/testing/guards`): checks an architecture test runs
// over a package's or an app's own source files. Visible text is read with the TypeScript parser, so
// `typescript` must be installed (an optional peer dependency).
export { findLines, findRawColors, RAW_COLOR, readImports } from "./lines.js";
export {
  collectVisibleTexts,
  DEFAULT_COPY_ATTRIBUTE,
  findForbiddenPhrases,
  findInlineCopy,
  type ForbiddenPhrase,
  type ForbiddenPhraseOptions,
  type VisibleText,
  type VisibleTextOptions,
} from "./visible-text.js";
export { readSourceFiles, type ReadSourceFilesOptions, type SourceFile } from "./source-files.js";
