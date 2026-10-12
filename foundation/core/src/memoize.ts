// A cache for pure functions of plain data: the arguments' content is the key, so two equal objects built apart hit
// the same entry. Least recently used entries go beyond `max`; nothing expires by time.

export interface MemoizeByContentOptions {
  /** The most entries kept; the least recently used one goes first. */
  readonly max: number;
}

/** `fn` with a cache, plus `clear()` to empty it. */
export type MemoizedFunction<Args extends readonly unknown[], Value> = ((...args: Args) => Value) & { readonly clear: () => void };

/**
 * `fn` cached by the content of its arguments: primitives, arrays, `Date`s and plain objects (key order does not
 * matter). An argument holding anything else (a function, a `Map`, a class instance, a cycle) throws a `TypeError`.
 * A promise that rejects is dropped, so the next call tries again. Throws a `RangeError` for a `max` that is not a
 * positive whole number.
 */
export function memoizeByContent<Args extends readonly unknown[], Value>(
  fn: (...args: Args) => Value,
  options: MemoizeByContentOptions,
): MemoizedFunction<Args, Value> {
  const { max } = options;
  if (!Number.isSafeInteger(max) || max < 1) throw new RangeError(`memoizeByContent: max must be a positive whole number, got ${String(max)}`);
  const cache = new Map<string, Value>();

  const memoized = (...args: Args): Value => {
    const key = toContentKey(args, new Set());
    if (cache.has(key)) {
      // Not `?? fn(...)`: a cached `undefined` is a hit too.
      const hit = cache.get(key) as Value;
      cache.delete(key);
      cache.set(key, hit);
      return hit;
    }
    const value = fn(...args);
    cache.set(key, value);
    if (cache.size > max) {
      const oldest = cache.keys().next();
      if (oldest.done !== true) cache.delete(oldest.value);
    }
    if (value instanceof Promise) {
      value.catch(() => {
        if (cache.get(key) === value) cache.delete(key);
      });
    }
    return value;
  };
  return Object.assign(memoized, { clear: () => cache.clear() });
}

function toContentKey(value: unknown, path: Set<object>): string {
  switch (typeof value) {
    case "undefined":
      return "u";
    case "boolean":
      return value ? "t" : "f";
    case "number":
      return `n${Object.is(value, -0) ? "-0" : String(value)}`;
    case "bigint":
      return `b${String(value)}`;
    case "string":
      return JSON.stringify(value);
    case "object":
      return value === null ? "null" : toObjectKey(value, path);
    default:
      throw new TypeError(`memoizeByContent: an argument holds a ${typeof value}, which has no content key`);
  }
}

function toObjectKey(value: object, path: Set<object>): string {
  if (value instanceof Date) return `d${String(value.getTime())}`;
  if (path.has(value)) throw new TypeError("memoizeByContent: an argument holds a cycle");
  path.add(value);
  let key: string;
  if (Array.isArray(value)) {
    key = `[${value.map((item: unknown) => toContentKey(item, path)).join(",")}]`;
  } else {
    const prototype: unknown = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError(`memoizeByContent: an argument holds a ${value.constructor.name}, which has no content key`);
    }
    const entries = Object.keys(value)
      .sort()
      .map((name) => `${JSON.stringify(name)}:${toContentKey((value as Record<string, unknown>)[name], path)}`);
    key = `{${entries.join(",")}}`;
  }
  path.delete(value);
  return key;
}
