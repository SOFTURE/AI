import type { ShotStep } from "../config/shot-steps.js";
import { findPlaceholders, resolvePlaceholders, type PlaceholderSources } from "../config/placeholders.js";
import type { ScreenshotEntry } from "./screenshot.js";
import type { SignInPlan } from "./sign-in.js";

/**
 * Every text of a `shots` run that may hold `{env:NAME}` or `{data:key}` (the sign-in's step values and phrase, each
 * entry's path, phrase and step values), resolved in one place with the place it came from, so an error names the
 * key to fix and never a value.
 */

export interface ShotTexts {
  entries: ScreenshotEntry[];
  signIn: SignInPlan | null;
}

export type ResolveShotTextsResult = { ok: true; texts: ShotTexts } | { ok: false; error: string };

class UnresolvedText extends Error {}

function resolveSteps(steps: readonly ShotStep[], where: string, resolve: (text: string, where: string) => string): ShotStep[] {
  return steps.map((step, index) => (step.do === "fill" ? { ...step, value: resolve(step.value, `${where}[${index}].value`) } : step));
}

/** The texts with their placeholders replaced; a page path gets its inserted values URL-encoded. */
export function resolveShotTexts(texts: ShotTexts, sources: PlaceholderSources): ResolveShotTextsResult {
  const resolve = (text: string, where: string, encode?: (value: string) => string): string => {
    const result = resolvePlaceholders(text, sources, encode);
    if (!result.ok) throw new UnresolvedText(`${where}: ${result.error}`);
    return result.value;
  };
  try {
    const signIn =
      texts.signIn === null
        ? null
        : { path: texts.signIn.path, steps: resolveSteps(texts.signIn.steps, "signIn.steps", resolve), expect: resolve(texts.signIn.expect, "signIn.expect") };
    const entries = texts.entries.map((entry) => {
      const where = `screenshot "${entry.id}"`;
      return {
        ...entry,
        path: resolve(entry.path, `${where} path`, encodeURIComponent),
        expect: resolve(entry.expect, `${where} expect`),
        steps: resolveSteps(entry.steps, `${where} steps`, resolve),
      };
    });
    return { ok: true, texts: { entries, signIn } };
  } catch (error) {
    if (error instanceof UnresolvedText) return { ok: false, error: error.message };
    throw error;
  }
}

function listTexts(texts: ShotTexts): string[] {
  const stepValues = (steps: readonly ShotStep[]) => steps.flatMap((step) => (step.do === "fill" ? [step.value] : []));
  const signIn = texts.signIn === null ? [] : [...stepValues(texts.signIn.steps), texts.signIn.expect];
  return [...signIn, ...texts.entries.flatMap((entry) => [entry.path, entry.expect, ...stepValues(entry.steps)])];
}

/** Whether any text reads what `signIn.prepare` prints. */
export function usesData(texts: ShotTexts): boolean {
  return listTexts(texts).some((text) => findPlaceholders(text).some((placeholder) => placeholder.kind === "data"));
}

/** The first `{env:NAME}` the environment does not set, checked before the app starts or the preparation runs. */
export function findUnsetVariable(texts: ShotTexts, env: Readonly<Record<string, string | undefined>>): string | null {
  for (const text of listTexts(texts)) {
    for (const { kind, key } of findPlaceholders(text)) {
      if (kind === "env" && (env[key] === undefined || env[key] === "")) return key;
    }
  }
  return null;
}
