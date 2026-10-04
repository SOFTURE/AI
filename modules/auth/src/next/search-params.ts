// A page's search params in the one shape auth's redirect rewrite takes.

/** A page's awaited `searchParams`, or any `URLSearchParams`. */
export type PageSearchParams = URLSearchParams | Readonly<Record<string, string | readonly string[] | undefined>>;

/** `searchParams` as `URLSearchParams`, every value of a repeated name kept. */
export function toUrlSearchParams(searchParams: PageSearchParams | undefined): URLSearchParams {
  if (searchParams instanceof URLSearchParams) return searchParams;
  const query = new URLSearchParams();
  for (const [name, value] of Object.entries(searchParams ?? {})) {
    for (const item of typeof value === "string" ? [value] : (value ?? [])) query.append(name, item);
  }
  return query;
}
