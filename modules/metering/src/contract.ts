// Result types and error codes of the metering module. No user-facing copy here: an app translates codes through
// `messages` (docs/02-module-standard.md §6).
import type { Err } from "@softure-ai/core";

export type MeteringErrorCode = "metering.budget_exceeded" | "metering.invalid_budget_limit" | "metering.reservation_not_found";

/** The units a provider bills in. `usd` is dollars; the others are the provider's own counts. */
export const METERING_UNITS = ["credits", "usd", "characters", "seconds", "tokens", "requests"] as const;
export type MeteringUnit = (typeof METERING_UNITS)[number];

export type BudgetPeriod = "day" | "month";

/** Whose spend a budget limits: every call of the provider, or each account's on its own. */
export type BudgetScope = { readonly kind: "provider" } | { readonly kind: "account"; readonly accountId: string };

/** A budget's state in its current period. Amounts are in the provider's unit. */
export interface BudgetState {
  readonly provider: string;
  readonly unit: MeteringUnit;
  readonly period: BudgetPeriod;
  readonly scope: BudgetScope;
  /** The effective limit: the one stored by `setBudgetLimit`, or the configured one. */
  readonly limit: number;
  /** Settled charges plus unexpired reservations of the period. */
  readonly spent: number;
  /** `limit - spent`, never below 0. */
  readonly remaining: number;
  /** The start of the next period, in the app's time zone. */
  readonly resetsAt: Date;
}

/** `reserveSpend` refused: the amount does not fit the first budget named here. */
export interface BudgetExceeded extends Err<"metering.budget_exceeded"> {
  readonly budget: BudgetState;
  /** The amount that was asked for. */
  readonly requested: number;
}

/** Budget held for one paid call until it is settled or released. */
export interface SpendReservation {
  readonly id: string;
  readonly provider: string;
  readonly unit: MeteringUnit;
  readonly amount: number;
  readonly accountId: string | null;
  readonly createdAt: Date;
  /** After this the reservation stops holding budget, and the prune job deletes it. */
  readonly expiresAt: Date;
}

/** One provider's spend in the current day or month. */
export interface SpendSummary {
  readonly provider: string;
  readonly unit: MeteringUnit;
  readonly period: BudgetPeriod;
  readonly accountId: string | null;
  readonly from: Date;
  readonly resetsAt: Date;
  readonly settled: number;
  /** Unexpired reservations not settled yet. */
  readonly reserved: number;
  /** `settled + reserved`. */
  readonly spent: number;
  /** The effective budget of this period and scope (stored or configured); `null` when the app declared none. */
  readonly limit: number | null;
  /** `limit - spent`, never below 0; `null` without a budget. */
  readonly remaining: number | null;
}

/** Narrows spend to the charges whose `attributes[attribute]` is `value`, e.g. one item's `{ jobId }`. */
export interface SpendFilter {
  readonly attribute: string;
  readonly value: string;
}

/** What a breakdown groups charges by: their `step`, or the value of one of their attributes. */
export type SpendGroupBy = "step" | { readonly attribute: string };

/** One group's spend in a breakdown. Amounts are in the provider's unit. */
export interface SpendBreakdownRow {
  /** The step or the attribute's value; `null` gathers the charges without one. */
  readonly key: string | null;
  readonly settled: number;
  /** Unexpired reservations not settled yet. */
  readonly reserved: number;
  /** `settled + reserved`. */
  readonly spent: number;
}

/** One provider's spend in the current day or month, per step or per attribute value. */
export interface SpendBreakdown {
  readonly provider: string;
  readonly unit: MeteringUnit;
  readonly period: BudgetPeriod;
  readonly accountId: string | null;
  readonly groupBy: SpendGroupBy;
  readonly filter: SpendFilter | null;
  readonly from: Date;
  readonly resetsAt: Date;
  /** Ordered by `spent`, highest first, then by key; the `null` key last. The rows add up to `getSpend`. */
  readonly rows: readonly SpendBreakdownRow[];
}

/** Identifies one declared budget: its provider, period and whether it limits each account on its own. */
export interface BudgetKey {
  readonly provider: string;
  readonly period: BudgetPeriod;
  /** `false` by default: the budget of the whole provider. */
  readonly perAccount?: boolean;
}

/** One declared budget's limits, for an operator's settings form. Amounts are in the provider's unit. */
export interface BudgetLimit {
  readonly provider: string;
  readonly unit: MeteringUnit;
  readonly period: BudgetPeriod;
  readonly perAccount: boolean;
  /** The limit from `metering({ providers })`. */
  readonly configuredLimit: number;
  /** The limit stored at runtime; `null` when none is. */
  readonly storedLimit: number | null;
  /** The limit in force: `storedLimit ?? configuredLimit`. */
  readonly limit: number;
  /** When the stored limit was set; `null` without one. */
  readonly updatedAt: Date | null;
  /** The account that set the stored limit; `null` without one, when none was named, or after its deletion. */
  readonly updatedBy: string | null;
}
