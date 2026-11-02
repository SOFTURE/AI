// Result types and error codes of the metering module. No user-facing copy here: an app translates codes through
// `messages` (docs/02-module-standard.md §6).
import type { Err } from "@softure-ai/core";

export type MeteringErrorCode = "metering.budget_exceeded" | "metering.reservation_not_found";

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
  /** The budget of this period and scope; `null` when the app set none. */
  readonly limit: number | null;
  /** `limit - spent`, never below 0; `null` without a budget. */
  readonly remaining: number | null;
}
