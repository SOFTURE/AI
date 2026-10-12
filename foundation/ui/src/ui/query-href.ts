// Server-safe: the address of a view picked by one query parameter. The other parameters stay, so a filter set
// elsewhere on the page survives the switch.

export interface QueryHrefOptions {
  readonly pathname: string;
  /** The current query string, with or without `?`. */
  readonly search: string;
  readonly param: string;
  /** The parameter's new value; `null` removes it (the default view). */
  readonly value: string | null;
}

/** `pathname` with `search` where `param` is set to `value` (or removed), the other parameters kept in order. */
export function getQueryHref({ pathname, search, param, value }: QueryHrefOptions): string {
  const params = new URLSearchParams(search);
  if (value === null) params.delete(param);
  else params.set(param, value);
  const query = params.toString();
  return query === "" ? pathname : `${pathname}?${query}`;
}
