// Version ranges in `module.json → dependsOn` (docs/02-module-standard.md §3): `x.y.z`, `^x.y.z`,
// `~x.y.z` or `*`, each optionally suffixed with `?` for an optional dependency. Caret and tilde
// follow npm, including caret on `0.x` (`^0.1.0` is `>=0.1.0 <0.2.0`).
import { err, ok, type Result } from "./result.js";

export interface VersionRange {
  readonly kind: "any" | "exact" | "caret" | "tilde";
  /** The base version; `null` for `*`. */
  readonly base: Version | null;
  /** `true` when the range ended in `?`: the dependency may be absent. */
  readonly optional: boolean;
}

/** `[major, minor, patch]`. */
export type Version = readonly [number, number, number];

const VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const RANGE = /^([\^~]?)(\S+?)(\?)?$/;

export function isVersion(text: string): boolean {
  return VERSION.test(text);
}

export function parseVersionRange(text: string): Result<VersionRange, "core.invalid_version_range"> {
  const match = RANGE.exec(text);
  if (match === null) {
    return err("core.invalid_version_range");
  }

  const [, operator = "", body = "", optionalMark] = match;
  const optional = optionalMark === "?";
  if (operator === "" && body === "*") {
    return ok({ kind: "any", base: null, optional });
  }

  const base = parseVersion(body);
  if (base === null) {
    return err("core.invalid_version_range");
  }
  const kind = operator === "^" ? "caret" : operator === "~" ? "tilde" : "exact";
  return ok({ kind, base, optional });
}

export function satisfiesRange(versionText: string, range: VersionRange): boolean {
  const version = parseVersion(versionText);
  if (version === null) {
    return false;
  }
  if (range.base === null) {
    return true;
  }

  const base = range.base;
  if (compareVersions(version, base) < 0) {
    return false;
  }
  switch (range.kind) {
    case "exact":
      return compareVersions(version, base) === 0;
    case "tilde":
      return version[0] === base[0] && version[1] === base[1];
    case "caret":
      return isWithinCaret(version, base);
    case "any":
      return true;
  }
}

function isWithinCaret(version: Version, base: Version): boolean {
  // The leftmost non-zero part of the base is the one that may not change.
  if (base[0] > 0) {
    return version[0] === base[0];
  }
  if (base[1] > 0) {
    return version[0] === 0 && version[1] === base[1];
  }
  return compareVersions(version, base) === 0;
}

function parseVersion(text: string): Version | null {
  const match = VERSION.exec(text);
  if (match === null) {
    return null;
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function compareVersions(left: Version, right: Version): number {
  return left[0] - right[0] || left[1] - right[1] || left[2] - right[2];
}
