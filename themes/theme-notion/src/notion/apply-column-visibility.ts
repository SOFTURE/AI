/**
 * The column definitions to render: those whose id is in `visibleIds`, in `order` when given (ids `order` does not
 * name follow in their own order). Pure: the definitions are returned, never changed.
 */
export function applyColumnVisibility<T extends { readonly id: string }>(
  definitions: readonly T[],
  visibleIds: readonly string[],
  order?: readonly string[],
): T[] {
  const visible = new Set(visibleIds);
  const picked = definitions.filter((definition) => visible.has(definition.id));
  if (order === undefined) return picked;
  const rank = new Map(order.map((id, index) => [id, index]));
  const rankOf = (id: string) => rank.get(id) ?? Number.POSITIVE_INFINITY;
  return picked
    .map((definition, index) => ({ definition, index }))
    .sort((a, b) => rankOf(a.definition.id) - rankOf(b.definition.id) || a.index - b.index)
    .map(({ definition }) => definition);
}
