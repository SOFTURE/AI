import { describe, expect, it } from "vitest";
import { readJunitCounts } from "./junit.js";

describe("readJunitCounts", () => {
  it("counts passed and failed cases and names the failed ones", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8" ?>
<testsuites name="vitest tests" tests="5" failures="1" errors="1">
  <testsuite name="src/a.test.ts" tests="5">
    <testcase classname="src/a.test.ts" name="adds &amp; rounds" time="0.01"></testcase>
    <testcase classname="src/a.test.ts" name="refuses &lt;empty&gt; input" time="0.01">
      <failure message="expected 1 to be 2" type="AssertionError">AssertionError: expected 1 to be 2</failure>
    </testcase>
    <testcase classname="src/b.test.ts" name="crashes" time="0.01"><error message="boom"/></testcase>
    <testcase classname="src/b.test.ts" name="is skipped" time="0"><skipped/></testcase>
    <testcase classname="src/b.test.ts" name="self-closing passes" time="0.01"/>
  </testsuite>
</testsuites>`;
    expect(readJunitCounts(xml)).toEqual({
      passed: 2,
      total: 4,
      red: ["src/a.test.ts › refuses <empty> input", "src/b.test.ts › crashes"],
    });
  });

  it("names a case without a class by its name only", () => {
    expect(readJunitCounts('<testsuite><testcase name="alone"><failure/></testcase></testsuite>')).toEqual({
      passed: 0,
      total: 1,
      red: ["alone"],
    });
  });

  it("reads an empty report as no cases", () => {
    expect(readJunitCounts("<testsuites></testsuites>")).toEqual({ passed: 0, total: 0, red: [] });
    expect(readJunitCounts("")).toEqual({ passed: 0, total: 0, red: [] });
  });

  it("reads single-quoted attributes and decodes numeric entities", () => {
    expect(readJunitCounts("<testcase classname='x' name='it&#39;s &#x41;'><failure/></testcase>").red).toEqual(["x › it's A"]);
  });

  it("reads a case with a very long run of attribute characters in linear time", () => {
    const xml = `<testcase ${"A".repeat(200_000)} name="long"><failure/></testcase>`;
    const started = performance.now();
    expect(readJunitCounts(xml).red).toEqual(["long"]);
    expect(performance.now() - started).toBeLessThan(1000);
  });
});
