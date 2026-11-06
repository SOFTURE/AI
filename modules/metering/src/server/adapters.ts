// Feeding the ledger from the usage hooks of other packages, read structurally so metering depends on neither:
// `@softure-ai/llm`'s `onUsage` (an awaited hook) and marketing-kit's footage `onCharge` (a synchronous one).
import { ok, type Ok } from "@softure-ai/core";
import { getProviderDefinition } from "./options.js";
import { recordCharge, type MeteringContext } from "./spend.js";

/** The fields of `@softure-ai/llm`'s `UsageRecord` the adapter reads. */
export interface LlmUsageLike {
  readonly provider: string;
  readonly model: string;
  readonly costUsd: number | null;
  readonly at: Date;
  readonly attributes: Readonly<Record<string, string>>;
}

/** The fields of marketing-kit's `FootageCharge` the adapter reads. */
export interface FootageChargeLike {
  readonly step: string;
  readonly item: string;
  readonly provider: string;
  /** Seconds of audio or music billed. */
  readonly units: number;
  /** The provider's reported charge, when its API returns one. */
  readonly credits?: number;
}

export interface LlmUsageAdapterOptions {
  /** The metering provider (unit `usd`) to record under; the record's `provider` by default. */
  readonly provider?: string;
  /** The charge's step; the record's model by default. */
  readonly step?: string;
}

/**
 * Records a model call's cost as a `usd` charge. The record's `accountId` attribute becomes the charge's account,
 * the other attributes and the model are kept. A record without a cost (`costUsd: null`) records nothing.
 */
export async function recordLlmUsage(
  ctx: MeteringContext,
  record: LlmUsageLike,
  options: LlmUsageAdapterOptions = {},
): Promise<Ok<{ readonly id: string } | null>> {
  const providerId = options.provider ?? record.provider;
  const provider = getProviderDefinition(ctx.config, providerId);
  if (provider.unit !== "usd") {
    throw new Error(`recordLlmUsage: provider "${provider.id}" bills in ${provider.unit}, and model costs are in usd`);
  }
  if (record.costUsd === null) return ok(null);
  const { accountId, ...attributes } = record.attributes;
  return recordCharge(ctx, {
    provider: provider.id,
    amount: record.costUsd,
    step: options.step ?? record.model,
    ...(accountId === undefined ? {} : { accountId }),
    attributes: { ...attributes, model: record.model },
    at: record.at,
  });
}

/** An `onUsage` hook for `createLlm({ onUsage })`: every priced call becomes a charge; a failed write propagates. */
export function createLlmUsageRecorder(ctx: MeteringContext, options: LlmUsageAdapterOptions = {}): (record: LlmUsageLike) => Promise<void> {
  return async (record) => {
    await recordLlmUsage(ctx, record, options);
  };
}

export interface FootageChargeRecorderOptions {
  /** The metering provider to record under; the charge's `provider` by default. */
  readonly provider?: string;
  /** For a provider billed in credits: the rate used when a charge reports no credits. Without it such a charge fails. */
  readonly creditsPerSecond?: number;
  /** The account the footage run is for. */
  readonly accountId?: string;
  /** Extra attributes for every charge, e.g. `{ filmId }`. */
  readonly attributes?: Readonly<Record<string, string>>;
}

export interface FootageChargeRecorder {
  /**
   * Pass as the pipeline's `onCharge`. Starts the write and returns at once. `attributes` are this charge's own,
   * merged over the recorder's; `item`, `units` and `reported` are reserved and always the charge's.
   */
  readonly onCharge: (charge: FootageChargeLike, attributes?: Readonly<Record<string, string>>) => void;
  /** Waits for every write started so far; rejects with the first failure. Await it when the run ends. */
  readonly flush: () => Promise<void>;
}

/**
 * Records each paid footage step: seconds for a provider billed in `seconds`, the reported credits (or
 * `creditsPerSecond` times the seconds) for one billed in `credits`. Each charge keeps the attributes `item`, `units`
 * (the seconds billed) and `reported` (`"true"` when the amount is the provider's reported credits), which
 * `getChargeRate` reads. `onCharge` is synchronous, so the writes run in the background and `flush` reports their
 * outcome.
 */
export function createFootageChargeRecorder(ctx: MeteringContext, options: FootageChargeRecorderOptions = {}): FootageChargeRecorder {
  const pending: Promise<unknown>[] = [];
  const failures: unknown[] = [];

  const record = async (charge: FootageChargeLike, attributes: Readonly<Record<string, string>> | undefined): Promise<void> => {
    const provider = getProviderDefinition(ctx.config, options.provider ?? charge.provider);
    const amount = getFootageAmount(provider.id, provider.unit, charge, options.creditsPerSecond);
    await recordCharge(ctx, {
      provider: provider.id,
      amount: amount.value,
      step: charge.step,
      ...(options.accountId === undefined ? {} : { accountId: options.accountId }),
      attributes: { ...options.attributes, ...attributes, item: charge.item, units: String(charge.units), reported: String(amount.isReported) },
    });
  };

  return {
    onCharge: (charge, attributes) => {
      // Kept for flush; the catch stores the failure so it is reported there, never left unhandled.
      pending.push(
        record(charge, attributes).catch((error: unknown) => {
          failures.push(error);
        }),
      );
    },
    flush: async () => {
      await Promise.all(pending.splice(0));
      const [first]: unknown[] = failures.splice(0);
      if (first === undefined) return;
      throw first instanceof Error ? first : new Error("createFootageChargeRecorder: a charge could not be recorded", { cause: first });
    },
  };
}

interface FootageAmount {
  readonly value: number;
  /** The amount is the provider's reported charge, not the app's rate or a seconds count. */
  readonly isReported: boolean;
}

function getFootageAmount(providerId: string, unit: string, charge: FootageChargeLike, creditsPerSecond: number | undefined): FootageAmount {
  if (unit === "seconds") return { value: charge.units, isReported: false };
  if (unit === "credits") {
    if (charge.credits !== undefined) return { value: charge.credits, isReported: true };
    if (creditsPerSecond !== undefined) return { value: charge.units * creditsPerSecond, isReported: false };
    throw new Error(`createFootageChargeRecorder: the ${charge.step} charge of "${providerId}" reports no credits; pass creditsPerSecond`);
  }
  throw new Error(`createFootageChargeRecorder: provider "${providerId}" bills in ${unit}; footage charges are in seconds or credits`);
}
