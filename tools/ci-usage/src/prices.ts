// What a runner minute costs, from the providers' published price lists, with the caller's overrides on top.
import { z } from "zod";
import type { GithubSku, RunnerClass } from "./runner.js";

export interface PriceTable {
  /** USD per minute of GitHub's standard hosted runners, by billing SKU. */
  github: Record<GithubSku, number>;
  /** USD per minute of Ubicloud standard runners (x64 and arm64 cost the same), by vCPU count. */
  ubicloudStandard: Record<string, number>;
  /** USD per minute of Ubicloud premium runners, by vCPU count. */
  ubicloudPremium: Record<string, number>;
  /** USD per minute by exact runner label; wins over everything above (larger GitHub runners, own runners). */
  labels: Record<string, number>;
  /** Where the built-in numbers come from and when they were checked. */
  source: string;
  checkedOn: string;
}

export const DEFAULT_PRICES: PriceTable = {
  github: {
    actions_linux_slim: 0.002,
    actions_linux: 0.006,
    actions_linux_arm: 0.005,
    actions_windows: 0.01,
    actions_windows_arm: 0.01,
    actions_macos: 0.062,
  },
  ubicloudStandard: { "2": 0.00125, "4": 0.0025, "8": 0.005, "16": 0.01, "30": 0.01875 },
  ubicloudPremium: { "2": 0.002, "4": 0.004, "8": 0.008, "16": 0.016, "30": 0.03 },
  labels: {},
  source: "https://docs.github.com/en/billing/reference/actions-runner-pricing, https://ubicloud.com/docs/about/pricing",
  checkedOn: "2026-11-18",
};

const PRICE = z.number().finite().nonnegative();
const OVERRIDES = z.record(z.string().min(1), PRICE);

export type PricesResult = { ok: true; prices: PriceTable } | { ok: false; error: string };

/** Merges a JSON object of `label → USD per minute` over the built-in table. An empty value keeps the table. */
export function parsePriceOverrides(json: string | undefined, base: PriceTable = DEFAULT_PRICES): PricesResult {
  if (json === undefined || json.trim() === "") return { ok: true, prices: base };
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    return { ok: false, error: `--prices is not JSON: ${json}` };
  }
  const parsed = OVERRIDES.safeParse(value);
  if (!parsed.success) return { ok: false, error: `--prices must be a JSON object of runner label to USD per minute, such as {"my-runner":0.004}` };
  return { ok: true, prices: { ...base, labels: { ...base.labels, ...parsed.data } } };
}

export interface PriceOptions {
  prices: PriceTable;
  /** Ubicloud premium is an account setting the job does not show; true prices every Ubicloud minute as premium. */
  ubicloudPremium: boolean;
}

/** USD per minute of one runner, or null when neither the table nor the caller knows it. */
export function getMinutePrice(runner: RunnerClass, options: PriceOptions): number | null {
  const byLabel = options.prices.labels[runner.label];
  if (byLabel !== undefined) return byLabel;
  switch (runner.provider) {
    case "github-hosted":
      return options.prices.github[runner.sku];
    case "ubicloud": {
      const table = options.ubicloudPremium ? options.prices.ubicloudPremium : options.prices.ubicloudStandard;
      return table[String(runner.vcpu)] ?? null;
    }
    case "self-hosted":
      return null;
  }
}
