import type { SuiteCounts } from "./suite-counts.js";

/** Counts of a JUnit XML report: Vitest (`--reporter=junit`) and Playwright (`junit` reporter) both write one. */
export type JunitCounts = SuiteCounts;

const TEST_CASE = /<testcase\b((?:"[^"]*"|'[^']*'|[^'">])*?)(\/>|>([\s\S]*?)<\/testcase>)/g;
const NAMED_ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9A-Fa-f]+|#[0-9]+|[A-Za-z]+);/g, (whole, entity: string) => {
    if (entity.startsWith("#x")) return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
    if (entity.startsWith("#")) return String.fromCodePoint(Number.parseInt(entity.slice(1), 10));
    return NAMED_ENTITIES[entity] ?? whole;
  });
}

// A fixed attribute name after whitespace: no backtracking over long runs of name characters.
const ATTRIBUTES = {
  name: /(?:^|\s)name\s*=\s*(?:"([^"]*)"|'([^']*)')/,
  classname: /(?:^|\s)classname\s*=\s*(?:"([^"]*)"|'([^']*)')/,
};

/** The value of the attribute `name` or `classname` in a tag's attribute text, or "" without one. */
function readAttribute(text: string, name: keyof typeof ATTRIBUTES): string {
  const match = ATTRIBUTES[name].exec(text);
  return decodeEntities(match?.[1] ?? match?.[2] ?? "");
}

/**
/** `<classname> › <name>` of a case, or the name alone without a class. */
function readCaseName(attributes: string): string {
  const name = readAttribute(attributes, "name");
  const className = readAttribute(attributes, "classname");
  return className === "" ? name : `${className} › ${name}`;
}

/**
 * Reads the test cases of a JUnit report without a full XML parser: the format is flat enough (`<testcase>` elements
 * with an optional `<failure>`, `<error>` or `<skipped>` child) and the report is the app's own output. Flaky cases
 * are known only from Surefire's `<flakyFailure>` and `<flakyError>`; other writers carry no such signal.
 */
export function readJunitCounts(xml: string): JunitCounts {
  const counts: JunitCounts = { passed: 0, total: 0, red: [], flaky: [] };
  for (const match of xml.matchAll(TEST_CASE)) {
    const body = match[3] ?? "";
    if (/<skipped\b/.test(body)) continue;
    counts.total += 1;
    const attributes = match[1] ?? "";
    if (!/<(failure|error)\b/.test(body)) {
      counts.passed += 1;
      // Surefire's rerun format: a case that failed, then passed on a rerun.
      if (/<flaky(Failure|Error)\b/.test(body)) counts.flaky.push(readCaseName(attributes));
      continue;
    }
    counts.red.push(readCaseName(attributes));
  }
  return counts;
}
