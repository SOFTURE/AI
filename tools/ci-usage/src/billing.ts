// What GitHub actually billed for Actions, per repository and SKU, from the billing usage API. Optional: it needs a
// fine-grained token with organization "Administration: read" or user "Plan: read", and its answer only ever
// completes the estimate.
import { z } from "zod";
import type { GithubClient } from "./github.js";

export type BillingAccount = { kind: "org" | "user"; name: string };

export type AccountResult = { ok: true; account: BillingAccount } | { ok: false; error: string };

/** Reads `org:<name>` or `user:<name>`; an empty value means no billing lookup. */
export function parseBillingAccount(value: string | undefined): AccountResult | null {
  if (value === undefined || value.trim() === "") return null;
  const match = /^(org|user):([A-Za-z0-9][A-Za-z0-9-]*)$/.exec(value.trim());
  if (!match?.[1] || !match[2]) return { ok: false, error: `--billing must be org:<organization> or user:<user>, not "${value}"` };
  return { ok: true, account: { kind: match[1] as "org" | "user", name: match[2] } };
}

const ITEM = z.object({
  date: z.string(),
  product: z.string(),
  sku: z.string(),
  quantity: z.number(),
  unitType: z.string(),
  netAmount: z.number(),
  grossAmount: z.number().optional(),
  repositoryName: z.string().nullable().optional(),
});

const USAGE = z.object({ usageItems: z.array(ITEM) });

export interface BilledSku {
  sku: string;
  minutes: number;
  grossUsd: number;
  netUsd: number;
}

export type BillingResult = { ok: true; byRepository: Record<string, BilledSku[]> } | { ok: false; error: string };

function getMonths(from: Date, to: Date): { year: number; month: number }[] {
  const months: { year: number; month: number }[] = [];
  let year = from.getUTCFullYear();
  let month = from.getUTCMonth();
  const last = new Date(to.getTime() - 1);
  while (year < last.getUTCFullYear() || (year === last.getUTCFullYear() && month <= last.getUTCMonth())) {
    months.push({ year, month: month + 1 });
    month += 1;
    if (month === 12) {
      month = 0;
      year += 1;
    }
  }
  return months;
}

/** The usage item's repository as `owner/name`: GitHub gives the name alone or the full name. */
function matchRepository(item: string | null | undefined, repositories: readonly string[]): string | null {
  if (!item) return null;
  return repositories.find((repository) => repository === item || repository.split("/")[1] === item) ?? null;
}

export interface BillingOptions {
  client: GithubClient;
  account: BillingAccount;
  repositories: readonly string[];
  from: Date;
  to: Date;
}

/** Sums the Actions minute items of the period per repository and SKU. */
export async function getBillingUsage(options: BillingOptions): Promise<BillingResult> {
  const base = options.account.kind === "org" ? `/organizations/${options.account.name}` : `/users/${options.account.name}`;
  const sums = new Map<string, Map<string, BilledSku>>();
  for (const { year, month } of getMonths(options.from, options.to)) {
    const result = await options.client.get(`${base}/settings/billing/usage`, { year: String(year), month: String(month) });
    if (!result.ok) return { ok: false, error: `billing usage of ${options.account.kind}:${options.account.name} unavailable: ${result.message}` };
    const parsed = USAGE.safeParse(result.data);
    if (!parsed.success) return { ok: false, error: `billing usage of ${options.account.kind}:${options.account.name} answered an unexpected shape` };
    for (const item of parsed.data.usageItems) {
      if (item.product.toLowerCase() !== "actions" || item.unitType.toLowerCase() !== "minutes") continue;
      const date = Date.parse(item.date);
      if (!(date >= options.from.getTime() && date < options.to.getTime())) continue;
      const repository = matchRepository(item.repositoryName, options.repositories);
      if (repository === null) continue;
      const skus = sums.get(repository) ?? new Map<string, BilledSku>();
      sums.set(repository, skus);
      const sum = skus.get(item.sku) ?? { sku: item.sku, minutes: 0, grossUsd: 0, netUsd: 0 };
      skus.set(item.sku, sum);
      sum.minutes += item.quantity;
      sum.grossUsd += item.grossAmount ?? item.netAmount;
      sum.netUsd += item.netAmount;
    }
  }
  const byRepository: Record<string, BilledSku[]> = {};
  for (const repository of options.repositories) {
    byRepository[repository] = [...(sums.get(repository)?.values() ?? [])]
      .map((sum) => ({ ...sum, grossUsd: Math.round(sum.grossUsd * 10_000) / 10_000, netUsd: Math.round(sum.netUsd * 10_000) / 10_000 }))
      .sort((a, b) => b.minutes - a.minutes);
  }
  return { ok: true, byRepository };
}
