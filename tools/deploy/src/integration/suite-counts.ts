/** What a run's test report says, whatever its format (JUnit XML, Playwright JSON). */
export interface SuiteCounts {
  /** Tests that ran and passed, on the first try or a retry. */
  passed: number;
  /** Tests that ran (skipped ones are left out). */
  total: number;
  /** Names of the failed tests, in report order. */
  red: string[];
  /** Names of the tests that passed only on a retry, in report order. */
  flaky: string[];
}

export type ReadSuiteCounts = { ok: true; counts: SuiteCounts } | { ok: false; problem: string };
