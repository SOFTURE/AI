import { z } from "zod";
import type { ReadSuiteCounts, SuiteCounts } from "./suite-counts.js";

/**
 * Reads Playwright's JSON reporter output (`--reporter=json`): suites nest suites and specs, and each spec holds one
 * test per project with its final `status`. Only the fields read here are checked; the rest of the report is ignored.
 */

const testSchema = z.looseObject({
  projectName: z.string().optional(),
  status: z.enum(["expected", "unexpected", "flaky", "skipped"]),
});

const specSchema = z.looseObject({
  title: z.string(),
  tests: z.array(testSchema),
});

interface Suite {
  title: string;
  specs?: z.infer<typeof specSchema>[] | undefined;
  suites?: Suite[] | undefined;
}

const suiteSchema: z.ZodType<Suite> = z.lazy(() =>
  z.looseObject({
    title: z.string(),
    specs: z.array(specSchema).optional(),
    suites: z.array(suiteSchema).optional(),
  }),
);

const reportSchema = z.looseObject({ suites: z.array(suiteSchema) });

/** `[project] › file › describe… › title`, the project only when the config names one. */
function toTestName(titles: string[], projectName: string | undefined): string {
  const name = titles.filter((title) => title !== "").join(" › ");
  return projectName === undefined || projectName === "" ? name : `[${projectName}] › ${name}`;
}

function addSuite(counts: SuiteCounts, suite: Suite, parents: string[]): void {
  const titles = [...parents, suite.title];
  for (const spec of suite.specs ?? []) {
    for (const test of spec.tests) {
      if (test.status === "skipped") continue;
      counts.total += 1;
      const name = toTestName([...titles, spec.title], test.projectName);
      if (test.status === "unexpected") {
        counts.red.push(name);
        continue;
      }
      counts.passed += 1;
      if (test.status === "flaky") counts.flaky.push(name);
    }
  }
  for (const child of suite.suites ?? []) addSuite(counts, child, titles);
}

export function readPlaywrightJsonCounts(text: string): ReadSuiteCounts {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    return { ok: false, problem: "the report is not JSON" };
  }
  const parsed = reportSchema.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue?.path.join(".") ?? "";
    return { ok: false, problem: `${path === "" ? "the report" : path}: ${issue?.message ?? "invalid"}` };
  }
  const counts: SuiteCounts = { passed: 0, total: 0, red: [], flaky: [] };
  for (const suite of parsed.data.suites) addSuite(counts, suite, []);
  return { ok: true, counts };
}
